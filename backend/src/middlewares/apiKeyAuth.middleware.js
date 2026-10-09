'use strict';

const apiKeyService = require('../services/apiKey.service');
const apiKeyUsageService = require('../services/apiKeyUsage.service');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate API Key requests.
 * Uses `Authorization: Bearer <sk_live_...>`
 */
const apiKeyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const rawKey = authHeader.split(' ')[1];
  if (!rawKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Empty token' });
  }

  try {
    const apiKey = await apiKeyService.verifyAndGetApiKey(rawKey);
    
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid, inactive, or expired API Key' });
    }

    // Attach details to request for downstream handlers and usage logging
    req.tenant_id = apiKey.tenant_id;
    req.apiKey = apiKey; // Save for usage logging and scope checking
    req.apiKeyScopes = apiKey.scopes;

    // We don't have a specific human user since this is server-to-server.
    // If endpoints expect req.user_id, we can set it to null or a special flag.
    req.user_id = null;
    req.isApiKeyAuth = true;

    // Asynchronously update last_used_at without blocking the request
    apiKeyService.updateLastUsed(apiKey.id, apiKey.tenant_id).catch(err => {
      logger.error(`[ApiKeyAuth] Failed to update last_used_at: ${err.message}`);
    });

    next();

    // Hook into response finish to log usage
    res.on('finish', () => {
      const start = req._startTime || Date.now(); // fallback
      const duration = Date.now() - start;
      apiKeyUsageService.logUsage(apiKey.id, req, res, duration);
    });

  } catch (error) {
    logger.error(`[ApiKeyAuth] Auth error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

/**
 * Middleware to enforce required scopes for an API Key route.
 * Should be used AFTER apiKeyAuth.
 * @param {string|string[]} requiredScopes 
 */
const requireScope = (requiredScopes) => {
  const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];

  return (req, res, next) => {
    if (!req.isApiKeyAuth) {
      // If the route supports both JWT and API Key, and JWT was used, bypass scope check.
      // But typically routes using requireScope are exclusively API-key authenticated.
      return next();
    }

    const hasScope = scopes.every(scope => (req.apiKeyScopes || []).includes(scope));
    if (!hasScope) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient API key scopes' });
    }
    next();
  };
};

// Capture start time for usage tracking latency
const captureStartTime = (req, res, next) => {
  req._startTime = Date.now();
  next();
};

module.exports = {
  apiKeyAuth: [captureStartTime, apiKeyAuth],
  requireScope,
};
