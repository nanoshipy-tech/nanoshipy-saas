const { verifyAccessToken, verifyPlatformAccessToken } = require('../services/token.service');
const { error } = require('../utils/apiResponse');
const { Tenant, User, Role, Permission, PlatformAdmin } = require('../models');
const { getRedisClient } = require('../config/redis.config');
const { PLATFORM_ROLES } = require('../constants/platformPermissions.constant');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.split(' ')[1]
      : (req.query?.token || req.cookies?.accessToken || req.cookies?.access_token);

    let payload;
    let isPlatform = false;

    if (token) {
      try {
        payload = verifyAccessToken(token);
      } catch (tokenErr) {
        if (tokenErr.name === 'TokenExpiredError') {
          return error(res, { code: 'TOKEN_EXPIRED', message: 'Token expired' }, 401);
        }
        try {
          payload = verifyPlatformAccessToken(token);
          isPlatform = true;
        } catch (platformErr) {
          if (platformErr.name === 'TokenExpiredError') {
            return error(res, { code: 'TOKEN_EXPIRED', message: 'Token expired' }, 401);
          }
          return error(res, { code: 'UNAUTHORIZED', message: 'Invalid token' }, 401);
        }
      }
    } else if (req.cookies?.refresh_token || req.cookies?.refreshToken) {
      // Fallback for direct browser document viewing (e.g. /orders/:id/pdf, /invoices/:id/pdf)
      try {
        const refreshTokenValue = req.cookies.refresh_token || req.cookies.refreshToken;
        const { RefreshToken, User } = require('../models');
        const hashUtils = require('../utils/hash');
        const tokenHash = hashUtils.sha256(refreshTokenValue);
        const sessionRecord = await RefreshToken.findOne({
          where: { token_hash: tokenHash, revoked_at: null },
        });
        if (sessionRecord && new Date(sessionRecord.expires_at) > new Date()) {
          const sessionUser = await User.findByPk(sessionRecord.user_id);
          if (sessionUser && sessionUser.status === 'active') {
            payload = {
              user_id: sessionUser.id,
              tenant_id: sessionUser.tenant_id,
              token_version: sessionUser.token_version || 1,
            };
          }
        }
      } catch (_) {}
    } else if (req.cookies?.platform_refresh_token) {
      // Fallback for platform admin direct browser document viewing
      try {
        const platformRefreshValue = req.cookies.platform_refresh_token;
        const { PlatformRefreshToken, PlatformAdmin } = require('../models');
        const hashUtils = require('../utils/hash');
        const tokenHash = hashUtils.sha256(platformRefreshValue);
        const sessionRecord = await PlatformRefreshToken.findOne({
          where: { token_hash: tokenHash, revoked_at: null },
        });
        if (sessionRecord && new Date(sessionRecord.expires_at) > new Date()) {
          const sessionAdmin = await PlatformAdmin.findByPk(sessionRecord.admin_id);
          if (sessionAdmin && sessionAdmin.status === 'active') {
            payload = {
              admin_id: sessionAdmin.id,
              role: sessionAdmin.role,
              token_version: sessionAdmin.token_version || 1,
              aud: 'platform-admin',
            };
            isPlatform = true;
          }
        }
      } catch (_) {}
    }

    if (!payload) {
      return error(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    // Support platform admin requests across shared endpoints (orders, shipments, rto, ndr, rate cards)
    if (isPlatform || payload.aud === 'platform-admin') {
      const adminId = payload.admin_id || payload.id;
      const admin = await PlatformAdmin.findByPk(adminId, { attributes: ['id', 'role', 'status', 'token_version'] });
      if (!admin || admin.status === 'disabled') {
        return error(res, { code: 'FORBIDDEN', message: 'Platform Admin account disabled or invalid' }, 403);
      }

      const adminVersion = admin.token_version || 1;
      const tokenVersion = payload.token_version || 0;
      if (tokenVersion < adminVersion) {
        return error(res, { code: 'TOKEN_REVOKED', message: 'Session has been invalidated. Please log in again.' }, 401);
      }

      const targetTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || null;

      req.user = {
        id: admin.id,
        tenant_id: targetTenantId,
        role: admin.role || 'super_admin',
        permissions: ['*'],
        isPlatformAdmin: true,
      };

      req.platformAdmin = {
        id: admin.id,
        role: admin.role,
        permissions: PLATFORM_ROLES[admin.role] || ['*'],
      };

      req.tenant = targetTenantId ? { id: targetTenantId } : { id: null };

      const { tenantScopeMiddleware } = require('./tenantScope.middleware');
      return tenantScopeMiddleware(req, res, next);
    }

    // Check if tenant is suspended (caching this check in Redis later would be an optimization)
    const tenant = await Tenant.findByPk(payload.tenant_id, { attributes: ['status', 'is_booking_office'] });
    if (!tenant || tenant.status === 'suspended') {
      return error(res, { code: 'TENANT_SUSPENDED', message: 'Account suspended' }, 403);
    }

    // Cache check for permissions
    const redis = getRedisClient();
    const cacheKey = `perm:${payload.user_id}`;
    let permissions = [];
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        permissions = JSON.parse(cached);
      }
    }

    const user = await User.findByPk(payload.user_id, {
      attributes: ['id', 'token_version', 'status'],
      include: [{
        model: Role,
        as: 'role',
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
      }]
    });

    if (!user || user.status === 'suspended') {
      return error(res, { code: 'UNAUTHORIZED', message: 'User account invalid or suspended' }, 401);
    }

    const userVersion = user.token_version || 1;
    const tokenVersion = payload.token_version || 0;
    if (tokenVersion < userVersion) {
      return error(res, { code: 'TOKEN_REVOKED', message: 'Session has been invalidated. Please log in again.' }, 401);
    }

    if (!permissions.length && user.role) {
      permissions = (user.role.permissions || []).map(p => p.key);
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(permissions), 'EX', 300); // 5 min TTL
      }
    }

    req.user = {
      id: payload.user_id,
      tenant_id: payload.tenant_id,
      role: payload.role || (user.role ? user.role.name : 'owner'),
      permissions,
      impersonated: payload.impersonated || false,
      impersonated_by: payload.impersonated_by || null,
      impersonator_role: payload.impersonator_role || null,
    };

    // Global block on writes during impersonation (unless impersonated by super_admin)
    if (req.user.impersonated && req.user.impersonator_role !== 'super_admin') {
      const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
      if (isWriteMethod) {
        return error(res, { code: 'IMPERSONATION_READ_ONLY', message: 'Write operations are disabled during impersonation' }, 403);
      }
    }

    req.tenant = { id: payload.tenant_id, is_booking_office: Boolean(tenant?.is_booking_office) };

    const { tenantScopeMiddleware } = require('./tenantScope.middleware');
    tenantScopeMiddleware(req, res, next);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, { code: 'TOKEN_EXPIRED', message: 'Token expired' }, 401);
    }
    return error(res, { code: 'UNAUTHORIZED', message: 'Invalid token' }, 401);
  }
};

module.exports = {
  authenticate,
};
