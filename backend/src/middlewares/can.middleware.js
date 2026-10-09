'use strict';

const { error } = require('../utils/apiResponse');

const can = (permissionKey) => {
  return (req, res, next) => {
    // 1. Feature Flag Check - When false, completely bypass granular checks
    if (process.env.RBAC_ENABLED !== 'true') {
      return next();
    }

    if (!req.user) {
      return error(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    // 2. Admin, owner, and platform_admin roles bypass granular permission checks
    const role = (req.user.role || '').toLowerCase();
    if (['admin', 'super_admin', 'owner', 'platform_admin', 'system_admin'].includes(role) || req.user.isPlatformAdmin) {
      return next();
    }

    // 3. Permission Matching
    const perms = req.user.permissions || [];
    const domain = permissionKey.split('.')[0]; // e.g. 'user' or 'order'

    if (
      perms.includes('*') ||
      perms.includes(permissionKey) ||
      perms.includes(`${domain}.*`)
    ) {
      return next();
    }

    return error(res, { code: 'FORBIDDEN', message: `Access denied. Requires permission: ${permissionKey}` }, 403);
  };
};

module.exports = can;
