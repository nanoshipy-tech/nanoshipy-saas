'use strict';

const { verifyPlatformAccessToken } = require('../services/token.service');
const { error } = require('../utils/apiResponse');
const { getRedisClient } = require('../config/redis.config');
const { PlatformAdmin } = require('../models');
const { PLATFORM_ROLES } = require('../constants/platformPermissions.constant');
const rbacService = require('../services/rbac.service');

const isPlatformAdmin = (options = { allowTempToken: false }) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const token = authHeader.split(' ')[1];
    
    // Verify using platform secret
    const payload = verifyPlatformAccessToken(token);

    if (payload.requires_2fa && !options.allowTempToken) {
      return error(res, { code: '2FA_REQUIRED', message: '2FA verification required' }, 403);
    }

    const admin = await PlatformAdmin.findByPk(payload.admin_id, {
      attributes: ['id', 'role', 'status', 'token_version', 'custom_role_id'],
    });
    if (!admin || admin.status === 'disabled') {
      return error(res, { code: 'FORBIDDEN', message: 'Admin account disabled' }, 403);
    }

    const adminVersion = admin.token_version || 1;
    const tokenVersion = payload.token_version || 0;
    if (tokenVersion < adminVersion) {
      return error(res, { code: 'TOKEN_REVOKED', message: 'Session has been invalidated. Please log in again.' }, 401);
    }

    const redis = getRedisClient();
    const cacheKey = `platform_perm:${payload.admin_id}`;
    let permissions = [];

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        permissions = JSON.parse(cached);
      }
    }

    if (!permissions.length) {
      if (admin.role === 'super_admin') {
        permissions = ['*'];
      } else if (admin.custom_role_id) {
        permissions = await rbacService.getAdminPermissions(admin.id);
      } else {
        permissions = PLATFORM_ROLES[admin.role] || [];
      }

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(permissions), 'EX', 300);
      }
    }

    req.platformAdmin = {
      id: payload.admin_id,
      role: payload.role,
      custom_role_id: admin.custom_role_id,
      permissions,
    };

    req.user = {
      id: payload.admin_id,
      role: payload.role,
      permissions,
      isPlatformAdmin: true,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, { code: 'TOKEN_EXPIRED', message: 'Token expired' }, 401);
    }
    return error(res, { code: 'UNAUTHORIZED', message: 'Invalid token' }, 401);
  }
};

module.exports = {
  isPlatformAdmin: isPlatformAdmin({ allowTempToken: false }),
  isPlatformAdminTemp: isPlatformAdmin({ allowTempToken: true }),
};
