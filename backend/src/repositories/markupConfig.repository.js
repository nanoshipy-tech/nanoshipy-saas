'use strict';

const { MarkupConfig, Tenant, CourierProvider } = require('../models');
const { Op } = require('sequelize');

/**
 * Get Effective Markup Percent applying the strict fallback chain:
 * 1. Seller + Courier + Zone
 * 2. Seller + Courier
 * 3. Seller + Zone
 * 4. Seller (all couriers/zones)
 * 5. Booking Office + Courier + Zone (if isBookingOffice)
 * 6. Booking Office + Courier (if isBookingOffice)
 * 7. Booking Office (if isBookingOffice)
 * 8. Courier + Zone
 * 9. Courier
 * 10. Zone
 * 11. Global rule
 * 12. Fallback: 30.00%
 */
async function getEffectiveMarkup(params = {}, legacyZone = null) {
  let courierProviderId = null;
  let zone = null;
  let sellerId = null;
  let isBookingOffice = false;
  let bookingOfficeId = null;

  if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
    courierProviderId = params.courierProviderId || params.carrierId || null;
    zone = params.zone || null;
    sellerId = params.sellerId || params.tenantId || null;
    isBookingOffice = Boolean(params.isBookingOffice);
    bookingOfficeId = params.bookingOfficeId || (isBookingOffice ? sellerId : null);
  } else {
    courierProviderId = params;
    zone = legacyZone;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeCondition = {
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
  };

  // 1. Seller + Courier + Zone
  if (sellerId && courierProviderId && zone) {
    const r = await MarkupConfig.findOne({
      where: {
        seller_id: sellerId,
        courier_provider_id: courierProviderId,
        zone,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 2. Seller + Courier
  if (sellerId && courierProviderId) {
    const r = await MarkupConfig.findOne({
      where: {
        seller_id: sellerId,
        courier_provider_id: courierProviderId,
        zone: null,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 3. Seller + Zone
  if (sellerId && zone) {
    const r = await MarkupConfig.findOne({
      where: {
        seller_id: sellerId,
        courier_provider_id: null,
        zone,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 4. Seller Global
  if (sellerId) {
    const r = await MarkupConfig.findOne({
      where: {
        seller_id: sellerId,
        courier_provider_id: null,
        zone: null,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 5-7. Booking Office specific
  if (isBookingOffice || bookingOfficeId) {
    const boId = bookingOfficeId || sellerId;
    if (courierProviderId && zone) {
      const r = await MarkupConfig.findOne({
        where: {
          booking_office_id: boId,
          courier_provider_id: courierProviderId,
          zone,
          ...activeCondition,
        },
        order: [['created_at', 'DESC']],
      });
      if (r) return r;
    }

    if (courierProviderId) {
      const r = await MarkupConfig.findOne({
        where: {
          booking_office_id: boId,
          courier_provider_id: courierProviderId,
          zone: null,
          ...activeCondition,
        },
        order: [['created_at', 'DESC']],
      });
      if (r) return r;
    }

    const boRule = await MarkupConfig.findOne({
      where: {
        [Op.or]: [
          { booking_office_id: boId },
          { scope: 'booking_office' },
        ],
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (boRule) return boRule;
  }

  // 8. Courier + Zone
  if (courierProviderId && zone) {
    const r = await MarkupConfig.findOne({
      where: {
        scope: { [Op.in]: ['courier_zone', 'courier'] },
        courier_provider_id: courierProviderId,
        zone,
        seller_id: null,
        booking_office_id: null,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 9. Courier
  if (courierProviderId) {
    const r = await MarkupConfig.findOne({
      where: {
        scope: 'courier',
        courier_provider_id: courierProviderId,
        seller_id: null,
        booking_office_id: null,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 10. Zone
  if (zone) {
    const r = await MarkupConfig.findOne({
      where: {
        scope: 'zone',
        zone,
        seller_id: null,
        booking_office_id: null,
        ...activeCondition,
      },
      order: [['created_at', 'DESC']],
    });
    if (r) return r;
  }

  // 11. Global rule
  const globalRule = await MarkupConfig.findOne({
    where: {
      scope: 'global',
      seller_id: null,
      booking_office_id: null,
      ...activeCondition,
    },
    order: [['created_at', 'DESC']],
  });
  if (globalRule) return globalRule;

  // 12. Default Seed Fallback (30.00%)
  return {
    scope: 'global',
    markup_percent: 30.00,
    flat_markup_amount: 0.00,
  };
}

async function listMarkups() {
  return MarkupConfig.findAll({
    include: [
      {
        model: Tenant,
        as: 'seller',
        attributes: ['id', 'company_name', 'subdomain'],
      },
      {
        model: Tenant,
        as: 'booking_office',
        attributes: ['id', 'company_name', 'subdomain'],
      },
      {
        model: CourierProvider,
        as: 'courier_provider',
        attributes: ['id', 'provider_key', 'display_name'],
      },
    ],
    order: [['created_at', 'DESC']],
  });
}

async function getMarkupById(id) {
  return MarkupConfig.findByPk(id, {
    include: [
      { model: Tenant, as: 'seller', attributes: ['id', 'company_name', 'subdomain'] },
      { model: Tenant, as: 'booking_office', attributes: ['id', 'company_name', 'subdomain'] },
      { model: CourierProvider, as: 'courier_provider', attributes: ['id', 'provider_key', 'display_name'] },
    ],
  });
}

async function createMarkup(payload, adminId = null) {
  const {
    scope = 'global',
    seller_id,
    booking_office_id,
    courier_provider_id,
    zone,
    markup_percent,
    flat_markup_amount,
    name,
    is_active,
    effective_from,
    effective_to,
  } = payload;

  return MarkupConfig.create({
    scope,
    seller_id: seller_id || null,
    booking_office_id: booking_office_id || null,
    courier_provider_id: courier_provider_id || null,
    zone: zone || null,
    markup_percent: markup_percent !== undefined ? parseFloat(markup_percent) : 30.00,
    flat_markup_amount: flat_markup_amount !== undefined ? parseFloat(flat_markup_amount) : 0.00,
    name: name || null,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    effective_from: effective_from || new Date().toISOString().slice(0, 10),
    effective_to: effective_to || null,
    created_by: adminId,
  });
}

async function updateMarkup(id, payload, adminId = null) {
  const rule = await MarkupConfig.findByPk(id);
  if (!rule) return null;

  const updates = {};
  if (payload.scope !== undefined) updates.scope = payload.scope;
  if (payload.seller_id !== undefined) updates.seller_id = payload.seller_id || null;
  if (payload.booking_office_id !== undefined) updates.booking_office_id = payload.booking_office_id || null;
  if (payload.courier_provider_id !== undefined) updates.courier_provider_id = payload.courier_provider_id || null;
  if (payload.zone !== undefined) updates.zone = payload.zone || null;
  if (payload.markup_percent !== undefined) updates.markup_percent = parseFloat(payload.markup_percent);
  if (payload.flat_markup_amount !== undefined) updates.flat_markup_amount = parseFloat(payload.flat_markup_amount);
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.is_active !== undefined) updates.is_active = Boolean(payload.is_active);
  if (payload.effective_from !== undefined) updates.effective_from = payload.effective_from;
  if (payload.effective_to !== undefined) updates.effective_to = payload.effective_to || null;
  if (adminId) updates.created_by = adminId;

  await rule.update(updates);
  return getMarkupById(id);
}

async function deleteMarkup(id) {
  const rule = await MarkupConfig.findByPk(id);
  if (!rule) return false;
  await rule.destroy();
  return true;
}

module.exports = {
  getEffectiveMarkup,
  listMarkups,
  getMarkupById,
  createMarkup,
  createOrUpdateMarkup: createMarkup,
  updateMarkup,
  deleteMarkup,
};
