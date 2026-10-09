'use strict';

const markupConfigRepo = require('../repositories/markupConfig.repository');
const codMarkupConfigRepo = require('../repositories/codMarkupConfig.repository');
const rtoMarkupConfigRepo = require('../repositories/rtoMarkupConfig.repository');
const { BadRequestError, NotFoundError } = require('../utils/errors');

async function getMarkupRules() {
  const markups = await markupConfigRepo.listMarkups();
  const codRule = await codMarkupConfigRepo.getCurrent();
  const rtoRule = await rtoMarkupConfigRepo.getCurrent();

  return {
    markups,
    cod: codRule,
    rto: rtoRule,
  };
}

async function saveMarkupRule(data, adminId = null) {
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
  } = data;

  if (markup_percent === undefined || markup_percent === null || isNaN(markup_percent)) {
    throw new BadRequestError('markup_percent must be a valid number.');
  }

  if (scope === 'seller' && !seller_id) {
    throw new BadRequestError('seller_id is required for seller scope.');
  }

  if (scope === 'booking_office' && !booking_office_id) {
    throw new BadRequestError('booking_office_id is required for booking_office scope.');
  }

  if (scope === 'courier' && !courier_provider_id) {
    throw new BadRequestError('courier_provider_id is required for courier scope.');
  }

  if (scope === 'courier_zone' && (!courier_provider_id || !zone)) {
    throw new BadRequestError('courier_provider_id and zone are required for courier_zone scope.');
  }

  if (scope === 'zone' && !zone) {
    throw new BadRequestError('zone is required for zone scope.');
  }

  return markupConfigRepo.createMarkup({
    scope,
    seller_id,
    booking_office_id,
    courier_provider_id,
    zone,
    markup_percent: parseFloat(markup_percent),
    flat_markup_amount: flat_markup_amount !== undefined ? parseFloat(flat_markup_amount) : 0.00,
    name,
    is_active,
    effective_from,
    effective_to,
  }, adminId);
}

async function updateMarkupRule(id, data, adminId = null) {
  const existing = await markupConfigRepo.getMarkupById(id);
  if (!existing) {
    throw new NotFoundError('Markup rule not found');
  }

  return markupConfigRepo.updateMarkup(id, data, adminId);
}

async function deleteMarkupRule(id) {
  const existing = await markupConfigRepo.getMarkupById(id);
  if (!existing) {
    throw new NotFoundError('Markup rule not found');
  }

  return markupConfigRepo.deleteMarkup(id);
}

async function updateCodRtoConfig(data, adminId = null) {
  const { flat_charge, percent_charge, surcharge_percent } = data;

  let codResult = null;
  let rtoResult = null;

  if (flat_charge !== undefined || percent_charge !== undefined) {
    const currentCod = await codMarkupConfigRepo.getCurrent();
    const newFlat = flat_charge !== undefined ? parseFloat(flat_charge) : parseFloat(currentCod.flat_charge);
    const newPct = percent_charge !== undefined ? parseFloat(percent_charge) : parseFloat(currentCod.percent_charge);
    codResult = await codMarkupConfigRepo.updateRule(newFlat, newPct);
  }

  if (surcharge_percent !== undefined) {
    rtoResult = await rtoMarkupConfigRepo.updateRule(parseFloat(surcharge_percent));
  }

  return {
    cod: codResult || await codMarkupConfigRepo.getCurrent(),
    rto: rtoResult || await rtoMarkupConfigRepo.getCurrent(),
  };
}

module.exports = {
  getMarkupRules,
  saveMarkupRule,
  updateMarkupRule,
  deleteMarkupRule,
  updateCodRtoConfig,
};
