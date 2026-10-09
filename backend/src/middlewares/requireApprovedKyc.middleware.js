'use strict';

const { Tenant } = require('../models');
const { error } = require('../utils/apiResponse');

/**
 * requireApprovedKyc Middleware
 * Ensures seller tenant has kyc_status === 'approved' before creating/shipping orders or configuring stores.
 */
const requireApprovedKyc = async (req, res, next) => {
  try {
    // Super admin impersonators can bypass for technical support / testing
    if (req.user?.impersonated && req.user?.impersonator_role === 'super_admin') {
      return next();
    }

    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return next();
    }

    const tenant = await Tenant.findByPk(tenantId, {
      attributes: ['id', 'status', 'kyc_status', 'company_name']
    });

    if (!tenant) {
      return error(res, { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' }, 404);
    }

    if (tenant.kyc_status !== 'approved') {
      return error(res, {
        code: 'ACCOUNT_PENDING_APPROVAL',
        message: 'Your account is pending KYC approval and warehouse configuration by the platform administration team. Order creation, shipping dispatch, and storefront integrations will be unlocked once approved.',
        kyc_status: tenant.kyc_status,
      }, 403);
    }

    if (tenant.status === 'suspended') {
      return error(res, {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is currently suspended. Please contact platform support.',
      }, 403);
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireApprovedKyc,
};
