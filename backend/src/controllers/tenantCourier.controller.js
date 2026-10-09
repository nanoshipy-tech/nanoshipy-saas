'use strict';

const courierProviderService = require('../services/courierProvider.service');
const { success } = require('../utils/apiResponse');

const listAvailable = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const couriers = await courierProviderService.getForTenant(tenantId);
    return success(res, couriers);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAvailable,
};
