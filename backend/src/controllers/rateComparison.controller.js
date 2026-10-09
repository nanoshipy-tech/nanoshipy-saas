'use strict';

const pricingService = require('../services/pricing.service');
const { success } = require('../utils/apiResponse');

const compareRates = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.tenant.id;
    const userId = req.user ? req.user.id : null;

    const options = {
      includeAll: req.query.all === 'true' || req.query.include_all === 'true',
    };

    const result = await pricingService.getTenantRates(orderId, tenantId, userId, options);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  compareRates,
};
