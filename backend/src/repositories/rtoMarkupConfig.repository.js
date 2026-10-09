'use strict';

const { RtoMarkupConfig } = require('../models');

async function getCurrent() {
  const rule = await RtoMarkupConfig.findOne({
    order: [['created_at', 'DESC']],
  });

  if (rule) return rule;

  // Auto-seed default rule matching spec: 5.00% surcharge
  return RtoMarkupConfig.create({
    surcharge_percent: 5.00,
    effective_from: new Date().toISOString().slice(0, 10),
  });
}

async function updateRule(surcharge_percent) {
  const current = await RtoMarkupConfig.findOne({
    order: [['created_at', 'DESC']],
  });

  if (current) {
    await current.update({ surcharge_percent });
    return current;
  }

  return RtoMarkupConfig.create({
    surcharge_percent,
    effective_from: new Date().toISOString().slice(0, 10),
  });
}

module.exports = {
  getCurrent,
  updateRule,
};
