'use strict';

const { error } = require('../utils/apiResponse');

const canPlatform = (requiredPermission) => {
  return (req, res, next) => {
    // 1. Feature Flag Check - When false, allow access (except explicit super_admin requirements)
    if (process.env.RBAC_ENABLED !== 'true') {
      if (requiredPermission === 'super_admin' && req.platformAdmin?.role !== 'super_admin') {
        return error(res, { code: 'FORBIDDEN', message: 'Super admin access required' }, 403);
      }
      return next();
    }

    if (!req.platformAdmin) {
      return error(res, { code: 'UNAUTHORIZED', message: 'Platform Admin context missing' }, 401);
    }

    // Super Admin bypasses all checks
    if (req.platformAdmin.role === 'super_admin') {
      return next();
    }

    if (requiredPermission === 'super_admin') {
      return error(res, { code: 'FORBIDDEN', message: 'Super admin access required' }, 403);
    }

    const perms = req.platformAdmin.permissions || [];
    const domain = requiredPermission.split('.')[0];

    if (
      perms.includes('*') ||
      perms.includes(requiredPermission) ||
      perms.includes(`${domain}.*`)
    ) {
      return next();
    }

    return error(res, { code: 'FORBIDDEN', message: `Insufficient platform permissions: requires ${requiredPermission}` }, 403);
  };
};

module.exports = {
  canPlatform,
};
