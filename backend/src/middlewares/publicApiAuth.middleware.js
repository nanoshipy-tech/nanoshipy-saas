'use strict';

const apiKeyService = require('../services/apiKey.service');
const { ApiKeyRevokedException, ApiKeyScopeError } = require('../utils/errors');
const logger = require('../utils/logger');

const publicApiAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header. Must be Bearer <api_key>.' }
      });
    }

    const token = authHeader.split(' ')[1];
    const key = await apiKeyService.verifyAndGetApiKey(token);

    if (!key) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid, expired, or revoked API key.' }
      });
    }

    // Check scope for mutating methods
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const scope = key.scopes && key.scopes.includes('read_write') ? 'read_write' : 'read_only';

    if (isMutating && scope === 'read_only') {
      return res.status(403).json({
        success: false,
        error: { code: 'API_KEY_SCOPE_ERROR', message: 'Insufficient scope for this operation. API key scope is read_only.' }
      });
    }

    // Inject into request context
    req.apiKey = key;
    req.sellerId = key.tenant_id;
    req.tenantId = key.tenant_id;
    req.sandboxMode = key.sandbox_mode;
    req.scope = scope;

    // Asynchronously update last used timestamp
    apiKeyService.updateLastUsed(key.id, key.tenant_id).catch(err => {
      logger.error(`[PublicApiAuth] Failed to update key last_used_at: ${err.message}`);
    });

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  publicApiAuth,
};
