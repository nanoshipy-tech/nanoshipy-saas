'use strict';

const { RateCard, CostRateSnapshot, Shipment, CourierProvider, Order, ShipmentRateQuote, PlatformSetting } = require('../models');
const { Op } = require('sequelize');
const zoneResolver = require('./zoneResolver');
const tenantCourierAccessRepository = require('../repositories/tenantCourierAccess.repository');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { NotFoundError, OrderNotShippableError, BadRequestError } = require('../utils/errors');
const config = require('../config/env');

// Default Named Constants (overridable via platform_settings)
const DEFAULT_COD_MIN = 40.00;
const DEFAULT_COD_PERCENT = 2.50;
const DEFAULT_RTO_SURCHARGE_PERCENT = 105.00; // Forward x 1.05

/**
 * Weight Slab Calculator
 * Rounds order weight UP to the nearest increment slab.
 *
 * Example: 1.3kg order on 0.5kg base & 0.5kg increment:
 * - 1.3 rounds up to 1.5kg
 * - Additional weight over base = 1.0kg = 2 increments of 0.5kg
 */
function calculateSlabs(orderWeightKg, baseWeightKg = 0.50, incrementKg = 0.50) {
  const w = Math.max(0.10, parseFloat(orderWeightKg) || 0.50);
  const base = Math.max(0.10, parseFloat(baseWeightKg) || 0.50);
  const inc = Math.max(0.10, parseFloat(incrementKg) || 0.50);

  if (w <= base) {
    return {
      totalSlabWeight: base,
      baseWeight: base,
      additionalUnits: 0,
    };
  }

  const excessWeight = w - base;
  const additionalUnits = Math.ceil(excessWeight / inc);
  const totalSlabWeight = base + (additionalUnits * inc);

  return {
    totalSlabWeight: Math.round(totalSlabWeight * 100) / 100,
    baseWeight: base,
    additionalUnits,
  };
}

/**
 * Round number to 2 decimal places.
 */
function round2(val) {
  return Math.round((parseFloat(val) || 0) * 100) / 100;
}

/**
 * Strict ALLOW-LIST DTO Transform
 * Guarantees zero cost/margin data leaks to tenant API responses.
 */
function toTenantDTO(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data.map(toTenantDTO);
  }

  // Pure whitelist transformation
  return {
    courier_provider_id: data.courier_provider_id,
    display_name: data.display_name || data.courier_display_name,
    service_type: data.service_type || data.service_mode,
    price: round2(data.price),
    cod_charge: round2(data.cod_charge || 0),
    estimated_days: data.estimated_days || 3,
    zone: data.zone,
    ...(data.id && { id: data.id }),
    ...(data.order_id && { order_id: data.order_id }),
    ...(data.awb_number && { awb_number: data.awb_number }),
    ...(data.status && { status: data.status }),
    ...(data.label_url && { label_url: data.label_url }),
    ...(data.created_at && { created_at: data.created_at }),
  };
}

/**
 * Calculate Tenant-facing Sell Pricing for an Order using rate_cards and zoneResolver.
 * Returned to tenant on POST /api/v1/orders/:orderId/rates.
 */
async function getTenantRates(orderId, tenantId, userId = null) {
  // 1. Load order
  const order = await Order.findOne({
    where: { id: orderId, tenant_id: tenantId },
    include: ['pickupAddress'],
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (!['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status)) {
    throw new OrderNotShippableError(`Order status "${order.status}" is not shippable`);
  }

  // 2. Resolve Shipping Zone (A, B, C, D, E)
  const pickupPincode = order.pickupAddress ? order.pickupAddress.pincode : '';
  const deliveryPincode = order.shipping_pincode;
  const zone = await zoneResolver.resolveZone(pickupPincode, deliveryPincode);

  // 3. Fetch tenant assigned active couriers
  const tenantAccess = await tenantCourierAccessRepository.listByTenant(tenantId);
  const activeProviders = tenantAccess.map(a => a.provider);

  // 4. Fetch Platform COD settings
  let codMin = DEFAULT_COD_MIN;
  let codPercent = DEFAULT_COD_PERCENT;
  try {
    const minSetting = await PlatformSetting.findOne({ where: { setting_key: 'cod_charge_min' } });
    const pctSetting = await PlatformSetting.findOne({ where: { setting_key: 'cod_charge_percent' } });
    if (minSetting) codMin = parseFloat(minSetting.setting_value);
    if (pctSetting) codPercent = parseFloat(pctSetting.setting_value);
  } catch (err) {
    logger.warn(`[RateCardService] Failed to read COD platform settings: ${err.message}`);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const expiryMinutes = config.shipment?.rateQuoteExpiryMinutes || 30;
  const quoteExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const rates = [];
  const quotesToInsert = [];

  for (const provider of activeProviders) {
    // Find active rate cards for this courier & zone
    const rateCards = await RateCard.findAll({
      where: {
        [Op.or]: [
          { courier_provider_id: provider.id },
          { courier_display_name: { [Op.iLike]: `%${provider.display_name}%` } },
        ],
        zone,
        is_active: true,
        effective_from: { [Op.lte]: todayStr },
        [Op.and]: [
          {
            [Op.or]: [
              { effective_to: null },
              { effective_to: { [Op.gte]: todayStr } },
            ],
          },
        ],
      },
    });

    if (rateCards.length === 0) {
      // Fallback rate card generation if no explicit slab configured
      const fallbackCard = {
        courier_provider_id: provider.id,
        courier_display_name: provider.display_name,
        service_mode: 'surface',
        base_weight_kg: 0.50,
        additional_weight_increment_kg: 0.50,
        zone,
        base_price: zone === 'A' ? 40.00 : zone === 'B' ? 50.00 : zone === 'C' ? 65.00 : zone === 'E' ? 95.00 : 75.00,
        additional_price: zone === 'A' ? 25.00 : zone === 'B' ? 30.00 : zone === 'C' ? 40.00 : zone === 'E' ? 60.00 : 45.00,
      };
      rateCards.push(fallbackCard);
    }

    for (const card of rateCards) {
      const weightSlabs = calculateSlabs(order.weight_kg, card.base_weight_kg, card.additional_weight_increment_kg);
      const sellPrice = parseFloat(card.base_price) + (weightSlabs.additionalUnits * parseFloat(card.additional_price));

      const codCharge = order.payment_mode === 'cod'
        ? Math.max(codMin, parseFloat(order.cod_amount || order.order_value || 0) * (codPercent / 100))
        : 0.00;

      const quoteId = require('uuid').v4();

      quotesToInsert.push({
        id: quoteId,
        order_id: orderId,
        courier_provider_id: provider.id,
        service_type: card.service_mode || 'surface',
        price: round2(sellPrice),
        cod_charge: round2(codCharge),
        estimated_days: card.service_mode === 'air' ? 2 : 4,
        quoted_at: new Date(),
        expires_at: quoteExpiresAt,
      });

      rates.push({
        courier_provider_id: provider.id,
        display_name: provider.display_name,
        service_type: card.service_mode || 'surface',
        price: round2(sellPrice),
        cod_charge: round2(codCharge),
        estimated_days: card.service_mode === 'air' ? 2 : 4,
        zone,
      });
    }
  }

  if (quotesToInsert.length > 0) {
    await ShipmentRateQuote.bulkCreate(quotesToInsert);
  }

  rates.sort((a, b) => a.price - b.price);

  if (userId) {
    await auditService.log({
      tenant_id: tenantId,
      user_id: userId,
      action: 'rates_compared',
      entity_type: 'Order',
      entity_id: orderId,
      metadata: { zone, count: rates.length },
    });
  }

  // Apply strict DTO transform before returning to tenant
  const tenantRates = toTenantDTO(rates);

  return {
    order_id: orderId,
    rates: tenantRates,
    quote_expires_at: quoteExpiresAt.toISOString(),
  };
}

/**
 * List rate cards for Platform Admin
 */
async function listRateCards(filters = {}, pagination = {}) {
  const { courier, mode, zone, is_active } = filters;
  const { page = 1, limit = 50 } = pagination;

  const where = {};
  if (mode) where.service_mode = mode;
  if (zone) where.zone = zone;
  if (is_active !== undefined) where.is_active = is_active === 'true' || is_active === true;

  if (courier) {
    where[Op.or] = [
      { courier_display_name: { [Op.iLike]: `%${courier}%` } },
      { courier_name: { [Op.iLike]: `%${courier}%` } },
    ];
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await RateCard.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });

  return {
    rows,
    pagination: {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Bulk Import Rate Cards from CSV for Platform Admin
 */
async function importRateCardsFromCsv(csvText, platformAdminId) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new BadRequestError('CSV file must contain a header row and at least one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''));
  
  let imported = 0;
  let skipped = 0;
  const errors = [];

  const providers = await CourierProvider.findAll();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 5) continue;

    const rowMap = {};
    headers.forEach((h, idx) => { rowMap[h] = cols[idx] || ''; });

    const courierName = rowMap.courier_name || rowMap.courier || rowMap.provider || cols[0];
    const modeStr = (rowMap.service_mode || rowMap.mode || cols[1] || 'surface').toLowerCase();
    const service_mode = modeStr.includes('air') ? 'air' : 'surface';
    const base_weight_kg = parseFloat(rowMap.base_weight_kg || rowMap.base_weight || cols[2] || 0.5);
    const additional_weight_increment_kg = parseFloat(rowMap.additional_weight_increment_kg || rowMap.additional_weight || cols[3] || 0.5);
    const zoneStr = (rowMap.zone || cols[4] || 'D').toUpperCase();
    const base_price = parseFloat(rowMap.base_price || rowMap.price || cols[5] || 0);
    const additional_price = parseFloat(rowMap.additional_price || rowMap.additional_rate || cols[6] || 0);
    const effective_from = rowMap.effective_from || new Date().toISOString().slice(0, 10);

    if (!['A', 'B', 'C', 'D', 'E'].includes(zoneStr)) {
      errors.push({ row: rowNum, reason: `Invalid zone '${zoneStr}'. Must be A, B, C, D, or E.` });
      skipped++;
      continue;
    }

    // Fuzzy/exact match provider
    const matchedProvider = providers.find(p =>
      p.provider_key.toLowerCase() === courierName.toLowerCase() ||
      p.display_name.toLowerCase().includes(courierName.toLowerCase()) ||
      courierName.toLowerCase().includes(p.display_name.toLowerCase())
    );

    try {
      const payload = {
        courier_provider_id: matchedProvider ? matchedProvider.id : null,
        courier_display_name: matchedProvider ? matchedProvider.display_name : courierName,
        service_mode,
        base_weight_kg,
        additional_weight_increment_kg,
        zone: zoneStr,
        base_price,
        additional_price,
        is_active: true,
        effective_from,
        created_by: platformAdminId,
      };

      const existing = await RateCard.findOne({
        where: {
          courier_provider_id: payload.courier_provider_id,
          service_mode,
          base_weight_kg,
          zone: zoneStr,
          effective_from,
        },
      });

      if (existing) {
        await existing.update(payload);
      } else {
        await RateCard.create(payload);
      }
      imported++;
    } catch (err) {
      errors.push({ row: rowNum, reason: err.message });
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

/**
 * Edit single Rate Card with versioning support
 */
async function updateRateCard(id, updateData, platformAdminId) {
  const card = await RateCard.findByPk(id);
  if (!card) throw new NotFoundError('Rate card entry not found');

  if (updateData.effective_from && updateData.effective_from !== card.effective_from) {
    // Insert new versioned row
    const newCard = await RateCard.create({
      ...card.toJSON(),
      ...updateData,
      id: undefined,
      created_by: platformAdminId,
      created_at: undefined,
      updated_at: undefined,
    });
    // Set effective_to on old row
    const yesterday = new Date(new Date(updateData.effective_from).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await card.update({ effective_to: yesterday });
    return newCard;
  }

  await card.update({ ...updateData, created_by: platformAdminId });
  return card;
}

/**
 * Platform Admin Margin Report (`GET /api/v1/platform/margin-report`)
 * Requires report.view / platform admin authorization.
 */
async function getMarginReport(filters = {}) {
  const { date_from, date_to, courier_id } = filters;

  const where = {};
  if (date_from || date_to) {
    where.captured_at = {};
    if (date_from) where.captured_at[Op.gte] = new Date(date_from);
    if (date_to) where.captured_at[Op.lte] = new Date(date_to);
  }
  if (courier_id) {
    where.courier_provider_id = courier_id;
  }

  const snapshots = await CostRateSnapshot.findAll({
    where,
    include: [
      { model: CourierProvider, as: 'provider', attributes: ['id', 'display_name', 'provider_key'] },
      { model: Shipment, as: 'shipment', attributes: ['id', 'cod_charge', 'status'] },
    ],
    order: [['captured_at', 'DESC']],
  });

  let totalSellRevenue = 0;
  let totalCost = 0;
  let codMargin = 0;
  let rtoMargin = 0;
  const courierMap = {};

  for (const s of snapshots) {
    const sell = parseFloat(s.sell_price) || 0;
    const cost = parseFloat(s.cost_price) || 0;
    totalSellRevenue += sell;
    totalCost += cost;

    if (s.shipment && s.shipment.cod_charge) {
      codMargin += parseFloat(s.shipment.cod_charge) || 0;
    }

    if (s.shipment && s.shipment.status === 'rto') {
      rtoMargin += (sell * 0.05); // 5% RTO surcharge component
    }

    const courierKey = s.provider ? s.provider.display_name : 'Other Courier';
    if (!courierMap[courierKey]) {
      courierMap[courierKey] = { sell: 0, cost: 0, margin: 0 };
    }
    courierMap[courierKey].sell += sell;
    courierMap[courierKey].cost += cost;
    courierMap[courierKey].margin += (sell - cost);
  }

  const totalMargin = totalSellRevenue - totalCost;
  const marginPercent = totalSellRevenue > 0 ? (totalMargin / totalSellRevenue) * 100 : 0;

  const byCourier = Object.entries(courierMap).map(([courier, data]) => ({
    courier,
    sell: round2(data.sell),
    cost: round2(data.cost),
    margin: round2(data.margin),
    margin_percent: data.sell > 0 ? round2((data.margin / data.sell) * 100) : 0,
  }));

  return {
    total_sell: round2(totalSellRevenue),
    total_sell_revenue: round2(totalSellRevenue),
    total_cost: round2(totalCost),
    total_margin: round2(totalMargin),
    shipping_margin_percent: round2(marginPercent),
    margin_percent: round2(marginPercent),
    cod_margin: round2(codMargin),
    rto_margin: round2(rtoMargin),
    by_courier: byCourier,
  };
}

module.exports = {
  calculateSlabs,
  round2,
  toTenantDTO,
  getTenantRates,
  listRateCards,
  importRateCardsFromCsv,
  updateRateCard,
  getMarginReport,
};
