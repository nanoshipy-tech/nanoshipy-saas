'use strict';

const { CourierCostRate } = require('../models');
const { Op } = require('sequelize');

async function findActiveByZone(zone) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return CourierCostRate.findAll({
    where: {
      zone,
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
    order: [['created_at', 'DESC']],
  });
}

async function listAll(filters = {}, pagination = {}) {
  const { courier, mode, zone, page = 1, limit = 50 } = filters;
  const where = {};
  if (mode) where.service_mode = mode;
  if (zone) where.zone = zone;
  if (courier) where.courier_display_name = { [Op.iLike]: `%${courier}%` };

  const offset = (page - 1) * limit;
  const { count, rows } = await CourierCostRate.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });

  return { rows, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) };
}

async function upsertCostRate(payload) {
  const existing = await CourierCostRate.findOne({
    where: {
      courier_provider_id: payload.courier_provider_id || null,
      service_mode: payload.service_mode,
      base_weight_kg: payload.base_weight_kg,
      zone: payload.zone,
      effective_from: payload.effective_from || new Date().toISOString().slice(0, 10),
    },
  });

  if (existing) {
    await existing.update(payload);
    return existing;
  }
  return CourierCostRate.create(payload);
}

module.exports = {
  findActiveByZone,
  listAll,
  upsertCostRate,
};
