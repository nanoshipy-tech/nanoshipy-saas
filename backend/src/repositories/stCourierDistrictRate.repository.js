'use strict';

const { StCourierDistrictRate } = require('../models');
const { Op } = require('sequelize');

async function listDistrictRates() {
  return StCourierDistrictRate.findAll({
    order: [['destination_district', 'ASC']],
  });
}

async function findByDistrict(districtName) {
  if (!districtName) return null;
  const clean = districtName.trim();
  return StCourierDistrictRate.findOne({
    where: {
      destination_district: { [Op.iLike]: clean },
      is_active: true,
    },
  });
}

async function upsertDistrictRate(data) {
  const district = (data.destination_district || '').trim();
  if (!district) throw new Error('destination_district is required');

  const payload = {
    destination_district: district,
    first_500g_rate:           parseFloat(data.first_500g_rate           || 30.00),
    additional_500g_rate:      parseFloat(data.additional_500g_rate      || 15.00),
    above_10kg_per_kg_rate:    parseFloat(data.above_10kg_per_kg_rate    || 25.00),
    cod_first_500g_rate:       parseFloat(data.cod_first_500g_rate       || 50.00),
    cod_additional_500g_rate:  parseFloat(data.cod_additional_500g_rate  || 20.00),
    cod_above_10kg_per_kg_rate:parseFloat(data.cod_above_10kg_per_kg_rate|| 35.00),
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
  };

  // When editing an existing record the frontend sends the record id —
  // prefer an id-based lookup so renaming the district doesn't create a duplicate.
  if (data.id) {
    const byId = await StCourierDistrictRate.findByPk(data.id);
    if (byId) return byId.update(payload);
  }

  // Fallback: match by district name (case-insensitive) for backwards-compat
  const existing = await StCourierDistrictRate.findOne({
    where: { destination_district: { [Op.iLike]: district } },
  });

  if (existing) return existing.update(payload);

  return StCourierDistrictRate.create(payload);
}

async function deleteDistrictRate(id) {
  const row = await StCourierDistrictRate.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

module.exports = {
  listDistrictRates,
  findByDistrict,
  getByDistrict: findByDistrict,
  upsertDistrictRate,
  deleteDistrictRate,
};
