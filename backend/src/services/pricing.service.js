'use strict';

const { Order, ShipmentRateQuote, CourierProvider, CourierCostRate, PincodeMaster } = require('../models');
const zoneResolver = require('./zoneResolver');
const courierCostRateRepo = require('../repositories/courierCostRate.repository');
const markupConfigRepo = require('../repositories/markupConfig.repository');
const codMarkupConfigRepo = require('../repositories/codMarkupConfig.repository');
const rtoMarkupConfigRepo = require('../repositories/rtoMarkupConfig.repository');
const stCourierDistrictRateRepo = require('../repositories/stCourierDistrictRate.repository');
const tenantCourierAccessRepository = require('../repositories/tenantCourierAccess.repository');
const providerCredentialService = require('./providerCredential.service');
const ProviderFactory = require('../providers/ProviderFactory');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { NotFoundError, OrderNotShippableError } = require('../utils/errors');
const config = require('../config/env');
const carrierMarginConfigRepo = require('../repositories/carrierMarginConfig.repository');
const { calculateBillableWeight } = require('../utils/weight.util');

/**
 * Round number to 2 decimal places.
 */
function round2(val) {
  return Math.round((parseFloat(val) || 0) * 100) / 100;
}

/**
 * Weight Slab Calculator
 * Rounds order weight UP to nearest increment slab.
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

const courierRoutingService = require('./courierRouting.service');

const { sanitizeCourierDisplayName, resolveCleanCarrierLogo } = require('../utils/courierBranding.util');

/**
 * Helper to determine if a rate has an explicit, valid carrier mapping
 */
function hasValidCarrierMapping(serviceType, providerKey) {
  if (!serviceType) return false;
  if (providerKey === 'stcourier' || serviceType === 'st_courier_surface') return true;
  if (!isNaN(Number(serviceType)) && Number(serviceType) > 0) return true;
  const knownKeys = ['delhivery', 'delhivery_surface', 'delhivery_express', 'bluedart', 'bluedart_express', 'xpressbees', 'xpressbees_express', 'ekart', 'shadowfax', 'amazon', 'dtdc', 'dtdc_express'];
  return knownKeys.includes(String(serviceType).toLowerCase().trim());
}

/**
 * Guarantees zero internal cost or markup fields leak to tenant API responses.
 * Also enforces white-label masking (never expose "Shipway").
 */
function toTenantRateDTO(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data.map(toTenantRateDTO);
  }

  const serviceType = data.service_type || data.service_mode;
  const displayName = sanitizeCourierDisplayName(data.display_name || data.courier_display_name, serviceType);
  const logoUrl = resolveCleanCarrierLogo(displayName, serviceType, data.logo_url);

  const price = round2(data.price);
  const codCharge = round2(data.cod_charge || 0);
  const costPrice = round2(data._internal?.cost_price || price);
  const markupPercent = data._internal?.markup_percent ?? 30;
  const markupAmount = round2(price - costPrice);

  const isValidMapping = typeof data.is_allocated === 'boolean'
    ? data.is_allocated
    : hasValidCarrierMapping(serviceType, data.provider_key);
  const isAllocated = Boolean(isValidMapping && !data.is_estimated);

  return {
    courier_provider_id: data.courier_provider_id,
    display_name: displayName,
    logo_url: logoUrl,
    service_type: serviceType,
    price: price,
    cod_charge: codCharge,
    total_price: round2(price + codCharge),
    rate_breakdown: {
      base_rate: costPrice,
      markup_percent: markupPercent,
      markup_amount: markupAmount,
      freight: price,
      cod_charge: codCharge,
      final_total: round2(price + codCharge),
    },
    estimated_days: data.estimated_days || 3,
    zone: data.zone,
    is_allocated: isAllocated,
    is_estimated: Boolean(data.is_estimated),
    allocation_badge: data.is_estimated ? '⏱️ Estimated Rate (Network Timeout)' : (isAllocated ? '⚡ Auto-Allocated by Network Routing' : '📦 Standard Rate'),
    routing_reason: data.routing_reason || (data.is_estimated ? 'Estimated fallback rate (network timeout)' : 'Allocated by regional network routing'),
    ...(data.id && { id: data.id }),
    ...(data.order_id && { order_id: data.order_id }),
  };
}

/**
 * Dynamic Rate Calculator for Seller Pricing
 * Applies seller-specific margin overrides or courier/zone markups,
 * and adds custom/configured COD charges.
 *
 * Correct Pricing Formula:
 * CustomerRate = (BaseFreight * (1 + MarkupPercentage / 100)) + Surcharge + CODFee
 * (GST 18% is applied at invoice / billing level, not compounded into markup carrier basis)
 *
 * @param {Object} params
 * @param {number} params.costPrice - Base freight cost from carrier/rate-card
 * @param {string} [params.sellerId] - Seller / Tenant ID
 * @param {string} [params.carrierId] - Courier provider UUID
 * @param {string} [params.zone] - Destination zone (A-E)
 * @param {boolean} [params.isCod=false] - Whether order payment mode is COD
 * @param {number} [params.codAmount=0] - COD value / order amount
 * @param {Object} [params.codRule=null] - Pre-fetched COD markup rule
 * @param {boolean} [params.applyShipwayTaxAndFee=false] - Whether to apply flat ₹4 Shipway platform surcharge
 * @returns {Promise<{ costPrice: number, rawCost: number, surcharge: number, sellPrice: number, markupPercent: number, codCharge: number, totalPrice: number }>}
 */
async function calculateSellerRate({
  costPrice,
  sellerId,
  carrierId,
  zone,
  isCod = false,
  codAmount = 0,
  codRule = null,
  applyShipwayTaxAndFee = false,
}) {
  const baseCost = parseFloat(costPrice) || 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  let sellerMargin = null;

  try {
    if (sellerId && carrierId) {
      sellerMargin = await carrierMarginConfigRepo.resolveMargin(carrierId, sellerId, 'all', todayStr);
    }
  } catch (err) {
    logger.warn(`[PricingService] Could not resolve seller margin override: ${err.message}`);
  }

  let markupPercent = 30.00;
  let marginType = 'percentage';
  let flatMarginVal = 0.00;

  if (sellerMargin) {
    marginType = sellerMargin.margin_type;
    if (marginType === 'percentage') {
      markupPercent = parseFloat(sellerMargin.margin_value) || 0.00;
    } else {
      flatMarginVal = parseFloat(sellerMargin.margin_value) || 0.00;
    }
  } else {
    const markupRule = await markupConfigRepo.getEffectiveMarkup({
      carrierId,
      zone,
      sellerId,
    });
    markupPercent = parseFloat(markupRule?.markup_percent ?? 30.00);
    if (markupRule?.flat_markup_amount && parseFloat(markupRule.flat_markup_amount) > 0) {
      flatMarginVal = parseFloat(markupRule.flat_markup_amount);
      marginType = 'flat';
    }
  }

  // Flat surcharge: ₹4.00 for Shipway platform handling, applied alongside freight (not compounded into markup basis)
  const surcharge = applyShipwayTaxAndFee ? 4.00 : 0.00;

  let sellPrice = 0.00;
  let effectiveMarkupPercent = markupPercent;

  if (marginType === 'flat') {
    sellPrice = round2(baseCost + flatMarginVal + surcharge);
    effectiveMarkupPercent = baseCost > 0 ? round2((flatMarginVal / baseCost) * 100) : 0;
  } else {
    // Correct formula: CustomerRate = (BaseFreight * (1 + MarkupPercentage / 100)) + Surcharge
    const freightWithMarkup = baseCost * (1 + markupPercent / 100);
    sellPrice = round2(freightWithMarkup + surcharge);
  }

  let codCharge = 0.00;
  if (isCod) {
    const effectiveCodRule = codRule || (await codMarkupConfigRepo.getCurrent());
    const flatCod = parseFloat(effectiveCodRule?.flat_charge || 40.00);
    const pctCod = parseFloat(effectiveCodRule?.percent_charge || 2.50);
    codCharge = round2(Math.max(flatCod, parseFloat(codAmount || 0) * (pctCod / 100)));
  }

  const costBasis = round2(baseCost + surcharge);

  return {
    costPrice: costBasis,
    rawCost: round2(baseCost),
    surcharge,
    sellPrice,
    markupPercent: effectiveMarkupPercent,
    codCharge,
    totalPrice: round2(sellPrice + codCharge),
  };
}

/**
 * Calculate Tenant Sell Rates dynamically via Markup Formula:
 * sellPrice = costPrice * (1 + markup%)
 *
 * Called on POST /api/v1/orders/:orderId/rates
 */
async function getTenantRates(orderId, tenantId, userId = null, options = {}) {
  // 1. Load order
  const order = await Order.findOne({
    where: { id: orderId, tenant_id: tenantId },
    include: ['pickupAddress'],
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (['delivered', 'failed'].includes(order.status)) {
    throw new OrderNotShippableError(`Order status "${order.status}" is not shippable`);
  }

  // 2. Resolve Geo-Routing Allocation (Intra-Tamil Nadu -> ST Courier vs Rest of India -> Shipway/National)
  const pickupPincode = order.pickupAddress ? order.pickupAddress.pincode : '';
  const pickupState = order.pickupAddress ? order.pickupAddress.state : '';
  const deliveryPincode = order.shipping_pincode;
  const deliveryState = order.shipping_state;

  const routingAllocation = await courierRoutingService.determineAssignedCourier(
    deliveryPincode,
    deliveryState,
    pickupPincode,
    pickupState
  );

  const zone = await zoneResolver.resolveZone(pickupPincode, deliveryPincode);

  // 3. Query tenant active providers
  const tenantAccess = await tenantCourierAccessRepository.listByTenant(tenantId);
  let activeProviders = tenantAccess.map(a => a.provider).filter(Boolean);
  if (activeProviders.length === 0) {
    activeProviders = await CourierProvider.findAll({ where: { is_active: true } });
  }

  // Enforce strict local vs interstate routing
  if (routingAllocation.isLocal) {
    // LOCAL / INTRA-TAMIL NADU: Exclusively ST Courier
    activeProviders = activeProviders.filter(p => p.provider_key === 'stcourier');
    if (activeProviders.length === 0) {
      const stProvider = await CourierProvider.findOne({ where: { provider_key: 'stcourier', is_active: true } });
      if (stProvider) activeProviders = [stProvider];
    }
  } else {
    // INTERSTATE / OTHER STATES: Exclusively Shipway (National Multi-Carrier Gateway)
    const shipwayProvider = activeProviders.find(p => p.provider_key === 'shipway') ||
      await CourierProvider.findOne({ where: { provider_key: 'shipway', is_active: true } });
    if (shipwayProvider) {
      activeProviders = [shipwayProvider];
    } else {
      activeProviders = activeProviders.filter(p => p.provider_key !== 'stcourier');
    }
  }

  // 4. Load COD Rule
  const codRule = await codMarkupConfigRepo.getCurrent();

  const expiryMinutes = config.shipment?.rateQuoteExpiryMinutes || 30;
  const quoteExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const rawRates = [];
  const quotesToInsert = [];

  if (routingAllocation.isLocal) {
    // -------------------------------------------------------------
    // INTRA-TAMIL NADU: ST Courier District-Wise Slab & Bulk Rates
    // -------------------------------------------------------------
    const stProvider = activeProviders.find(p => p.provider_key === 'stcourier') ||
      await CourierProvider.findOne({ where: { provider_key: 'stcourier', is_active: true } });

    if (!stProvider) {
      throw new NotFoundError('ST Courier provider is not active or configured');
    }

    // Resolve origin district from pickup/origin pincode via PincodeMaster (ST Courier rates are based on origin branch district)
    let originDistrict = null;
    if (pickupPincode) {
      const pinRecord = await PincodeMaster.findOne({ where: { pincode: String(pickupPincode).trim() } });
      if (pinRecord && pinRecord.district) {
        originDistrict = pinRecord.district.trim();
      }
    }
    if (!originDistrict && order.pickupAddress?.district) {
      originDistrict = order.pickupAddress.district.trim();
    }
    if (!originDistrict && order.pickupAddress?.city) {
      originDistrict = order.pickupAddress.city.trim();
    }

    // Fallback to destination district if origin district cannot be determined
    let destDistrict = null;
    if (deliveryPincode) {
      const pinRecord = await PincodeMaster.findOne({ where: { pincode: deliveryPincode } });
      if (pinRecord && pinRecord.district) {
        destDistrict = pinRecord.district.trim();
      }
    }
    if (!destDistrict && order.shipping_city) {
      destDistrict = order.shipping_city.trim();
    }

    const effectiveDistrict = originDistrict || destDistrict;
    const districtRate = effectiveDistrict ? await stCourierDistrictRateRepo.findByDistrict(effectiveDistrict) : null;
    if (!districtRate) {
      throw new NotFoundError(`No ST Courier rate card configured for district: ${effectiveDistrict || pickupPincode || deliveryPincode || 'unknown'}`);
    }

    const weight = Math.max(0.1, parseFloat(order.weight_kg) || 0.50);
    const isCod = order.payment_mode === 'cod';
    let costPrice = 0.00;

    if (weight <= 10.0) {
      // Slab pricing: first 500g + additional 500g increments up to 10kg
      const first500g = isCod && districtRate.cod_first_500g_rate != null
        ? parseFloat(districtRate.cod_first_500g_rate)
        : parseFloat(districtRate.first_500g_rate);
      const add500g = isCod && districtRate.cod_additional_500g_rate != null
        ? parseFloat(districtRate.cod_additional_500g_rate)
        : parseFloat(districtRate.additional_500g_rate);
      const slabs = calculateSlabs(weight, 0.50, 0.50);
      costPrice = first500g + (slabs.additionalUnits * add500g);
    } else {
      // Bulk pricing: flat per-kg rate across entire billable weight
      const perKgRate = isCod && districtRate.cod_above_10kg_per_kg_rate != null
        ? parseFloat(districtRate.cod_above_10kg_per_kg_rate)
        : parseFloat(districtRate.above_10kg_per_kg_rate);
      const billableWeight = Math.ceil(weight);
      costPrice = billableWeight * perKgRate;
    }

    // COD calculation based on shipment (order) value, NOT shipment weight
    let codCharge = 0.00;
    if (isCod) {
      const orderValue = parseFloat(order.cod_amount || order.order_value || 0);
      const flatCod = parseFloat(codRule?.flat_charge || 30.00);
      const pctCod = parseFloat(codRule?.percent_charge || 2.00);
      codCharge = round2(Math.max(flatCod, orderValue * (pctCod / 100)));
    }

    const markupRule = await markupConfigRepo.getEffectiveMarkup({
      courierProviderId: stProvider.id,
      zone,
      sellerId: tenantId,
    });
    let markupPercent = 0.00;
    if (markupRule && markupRule.scope !== 'global') {
      markupPercent = parseFloat(markupRule.markup_percent || 0);
    }

    const sellPrice = round2(costPrice * (1 + markupPercent / 100));
    const quoteId = require('uuid').v4();

    quotesToInsert.push({
      id: quoteId,
      order_id: orderId,
      courier_provider_id: stProvider.id,
      service_type: 'st_courier_surface',
      price: sellPrice,
      cod_charge: codCharge,
      estimated_days: 1,
      quoted_at: new Date(),
      expires_at: quoteExpiresAt,
    });

    rawRates.push({
      courier_provider_id: stProvider.id,
      provider_key: 'stcourier',
      display_name: 'ST Courier (Tamil Nadu Express)',
      service_type: 'st_courier_surface',
      price: sellPrice,
      cod_charge: codCharge,
      estimated_days: 1,
      zone,
      _internal: {
        cost_price: round2(costPrice),
        markup_percent: markupPercent,
      },
    });
  } else {
    // -------------------------------------------------------------
    // INTERSTATE / REST OF INDIA: Shipway Multi-Carrier Gateway
    // -------------------------------------------------------------
    let shipwayProvider = await CourierProvider.scope('withCredentials').findOne({
      where: { provider_key: 'shipway', is_active: true }
    });

    if (!shipwayProvider) {
      const activeNonSt = activeProviders.find(p => p.provider_key !== 'stcourier');
      if (activeNonSt) {
        shipwayProvider = await CourierProvider.scope('withCredentials').findByPk(activeNonSt.id);
      }
    }

    if (!shipwayProvider) {
      throw new NotFoundError('Shipway provider is not active or configured');
    }

    const { decrypt } = require('./providerCredential.service');
    const shipwayCreds = decrypt(shipwayProvider.credentials_encrypted);
    let liveRates = [];

    // Calculate package billable weight (Math.max(dead_weight, volumetric_weight))
    const billableWeight = calculateBillableWeight(
      order.weight_kg,
      order.length_cm,
      order.width_cm,
      order.height_cm
    );
    const dimensions = {
      length: parseFloat(order.length_cm) || 10,
      width: parseFloat(order.width_cm) || 10,
      breadth: parseFloat(order.width_cm) || 10,
      height: parseFloat(order.height_cm) || 10,
    };

    try {
      const adapter = await ProviderFactory.getAdapter(shipwayProvider.provider_key, shipwayCreds, shipwayProvider.config, shipwayProvider.id);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Shipway rates timeout')), 8000));
      const res = await Promise.race([
        adapter.getRates({
          pickupPincode,
          deliveryPincode,
          weight: billableWeight,
          dimensions,
          paymentMode: order.payment_mode,
          codAmount: order.cod_amount || order.order_value,
        }),
        timeoutPromise,
      ]);

      if (res && res.success && Array.isArray(res.data?.rates) && res.data.rates.length > 0) {
        liveRates = res.data.rates;
      }
    } catch (err) {
      logger.warn(`[PricingService] Live Shipway rates fetch skipped/failed: ${err.message}`);
    }

    if (liveRates.length > 0) {
      for (const r of liveRates) {
        const costPrice = parseFloat(r.price || 0);
        if (costPrice <= 0) continue;

        const ratePricing = await calculateSellerRate({
          costPrice,
          sellerId: tenantId,
          carrierId: shipwayProvider.id,
          zone,
          isCod: order.payment_mode === 'cod',
          codAmount: order.cod_amount || order.order_value,
          codRule,
          applyShipwayTaxAndFee: true,
        });

        const serviceType = String(r.carrierId || r.serviceType || '80622');
        const displayName = sanitizeCourierDisplayName(r.courierName || r.carrierTitle || 'Partner Express', serviceType);
        const quoteId = require('uuid').v4();

        quotesToInsert.push({
          id: quoteId,
          order_id: orderId,
          courier_provider_id: shipwayProvider.id,
          service_type: serviceType,
          price: ratePricing.sellPrice,
          cod_charge: ratePricing.codCharge,
          estimated_days: r.estimatedDays || 3,
          quoted_at: new Date(),
          expires_at: quoteExpiresAt,
        });

        rawRates.push({
          courier_provider_id: shipwayProvider.id,
          provider_key: shipwayProvider.provider_key,
          display_name: displayName,
          logo_url: resolveCleanCarrierLogo(displayName, serviceType, shipwayProvider.logo_url),
          service_type: serviceType,
          price: ratePricing.sellPrice,
          cod_charge: ratePricing.codCharge,
          estimated_days: r.estimatedDays || 3,
          zone,
          _internal: {
            cost_price: ratePricing.costPrice,
            markup_percent: ratePricing.markupPercent,
          },
        });
      }
    } else {
      // Full contracted carrier fleet with competitive market rates and transit times
      const fallbackCarriers = [
        { id: '80593', name: 'XpressBees Surface', baseCost: 42.00, days: 3 },
        { id: '80622', name: 'Delhivery Surface', baseCost: 46.02, days: 3 },
        { id: '79681', name: 'Shadowfax Surface', baseCost: 44.00, days: 3 },
        { id: '82861', name: 'Ekart Logistics', baseCost: 45.50, days: 3 },
        { id: '19339', name: 'Amazon Shipping', baseCost: 48.00, days: 2 },
        { id: '81769', name: 'BlueDart Surface', baseCost: 49.00, days: 3 },
        { id: '80800', name: 'DTDC Express', baseCost: 52.00, days: 2 },
        { id: '7377',  name: 'BlueDart Express (Air)', baseCost: 55.00, days: 2 },
        { id: '80652', name: 'XpressBees Air Priority', baseCost: 58.00, days: 1 },
        { id: '7442',  name: 'Delhivery Air Express', baseCost: 62.00, days: 1 },
      ];

      for (const fc of fallbackCarriers) {
        const weightSlabs = calculateSlabs(billableWeight, 0.50, 0.50);
        const costPrice = fc.baseCost + (weightSlabs.additionalUnits * 25.00);
        const ratePricing = await calculateSellerRate({
          costPrice,
          sellerId: tenantId,
          carrierId: shipwayProvider.id,
          zone,
          isCod: order.payment_mode === 'cod',
          codAmount: order.cod_amount || order.order_value,
          codRule,
          applyShipwayTaxAndFee: true,
        });

        const quoteId = require('uuid').v4();

        quotesToInsert.push({
          id: quoteId,
          order_id: orderId,
          courier_provider_id: shipwayProvider.id,
          service_type: fc.id,
          price: ratePricing.sellPrice,
          cod_charge: ratePricing.codCharge,
          estimated_days: fc.days,
          quoted_at: new Date(),
          expires_at: quoteExpiresAt,
        });

        rawRates.push({
          courier_provider_id: shipwayProvider.id,
          provider_key: 'shipway',
          display_name: `${fc.name} (Estimated)`,
          logo_url: resolveCleanCarrierLogo(fc.name, fc.id),
          service_type: fc.id,
          price: ratePricing.sellPrice,
          cod_charge: ratePricing.codCharge,
          estimated_days: fc.days,
          zone,
          is_estimated: true,
          routing_reason: 'Estimated fallback rate (network timeout)',
          _internal: {
            cost_price: ratePricing.costPrice,
            markup_percent: ratePricing.markupPercent,
          },
        });
      }
    }
  }

  if (quotesToInsert.length > 0) {
    await ShipmentRateQuote.bulkCreate(quotesToInsert);
  }

  // Sort cheapest to most expensive as initial baseline
  rawRates.sort((a, b) => a.price - b.price);

  // Evaluate Shipping Allocation Rules (supporting multiple rules & up to 5 prioritized fallback couriers per rule)
  const shippingRuleEvaluator = require('./shippingRuleEvaluator.service');
  const evaluation = await shippingRuleEvaluator.evaluateOptimalCourier({
    tenantId,
    pickupAddressId: order.pickup_address_id,
    weightKg: parseFloat(order.weight_kg) || 0.5,
    isCod: order.payment_mode === 'cod',
    paymentMode: order.payment_mode,
    zone,
    deliveryPincode,
    availableRates: rawRates,
    isLocalTn: routingAllocation.isLocal,
  });

  const winningRate = evaluation.allocatedRate || rawRates[0];

  rawRates.forEach((r) => {
    const isWinner = (r === winningRate) || (
      String(r.service_type || '') === String(winningRate?.service_type || '') &&
      String(r.courier_provider_id || '') === String(winningRate?.courier_provider_id || '')
    );
    r.is_allocated = isWinner;
    if (isWinner) {
      r.allocation_badge = evaluation.allocationBadge;
      r.routing_reason = evaluation.routingReason;
    }
  });

  // Sort so winning auto-allocated courier is first
  rawRates.sort((a, b) => (b.is_allocated ? 1 : 0) - (a.is_allocated ? 1 : 0));

  if (userId) {
    try {
      await auditService.log({
        tenant_id: tenantId,
        user_id: userId,
        action: 'rates_compared',
        entity_type: 'Order',
        entity_id: orderId,
        metadata: { zone, count: rawRates.length, allocated_courier: winningRate?.service_type },
      });
    } catch (auditErr) {
      logger.warn(`[PricingService] Audit log skipped: ${auditErr.message}`);
    }
  }

  // Auto-allocate single courier mode (default): Return strictly the allocated courier
  // If explicitly requested via options.includeAll (e.g. for superadmin debug view), return all
  const shouldReturnAll = Boolean(options && (options.includeAll || options.all));
  const ratesToDeliver = shouldReturnAll ? rawRates : (winningRate ? [winningRate] : rawRates.slice(0, 1));
  const tenantRates = toTenantRateDTO(ratesToDeliver);

  return {
    order_id: orderId,
    rates: tenantRates,
    quote_expires_at: quoteExpiresAt.toISOString(),
    allocated_courier: winningRate ? toTenantRateDTO(winningRate) : null,
    total_serviceable_couriers: rawRates.length,
    matched_rule: evaluation.matchedRule ? {
      id: evaluation.matchedRule.id,
      name: evaluation.matchedRule.name,
      priority_rank: evaluation.priorityRank,
    } : null,
  };
}

/**
 * Compute RTO Sell Price given Forward Sell Price
 * rtoSellPrice = forwardSellPrice * (1 + rtoMarkupSurcharge%)
 */
async function getRtoPrice(forwardSellPrice) {
  const rtoRule = await rtoMarkupConfigRepo.getCurrent();
  const surchargePct = parseFloat(rtoRule.surcharge_percent || 5.00);
  return round2(parseFloat(forwardSellPrice) * (1 + surchargePct / 100));
}

module.exports = {
  calculateSlabs,
  round2,
  toTenantRateDTO,
  getTenantRates,
  getRtoPrice,
  calculateSellerRate,
};
