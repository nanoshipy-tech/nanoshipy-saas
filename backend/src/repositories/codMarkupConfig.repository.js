'use strict';

const { CodMarkupConfig } = require('../models');

async function getCurrent() {
  const rule = await CodMarkupConfig.findOne({
    order: [['created_at', 'DESC']],
  });

  if (rule) return rule;

  // Auto-seed default rule matching spec: ₹40 flat or 2.50%
  return CodMarkupConfig.create({
    flat_charge: 40.00,
    percent_charge: 2.50,
    effective_from: new Date().toISOString().slice(0, 10),
  });
}

async function updateRule(flat_charge, percent_charge) {
  const current = await CodMarkupConfig.findOne({
    order: [['created_at', 'DESC']],
  });

  if (current) {
    await current.update({ flat_charge, percent_charge });
    return current;
  }

  return CodMarkupConfig.create({
    flat_charge,
    percent_charge,
    effective_from: new Date().toISOString().slice(0, 10),
  });
}

module.exports = {
  getCurrent,
  updateRule,
};
