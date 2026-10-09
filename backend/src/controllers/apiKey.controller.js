'use strict';

const apiKeyService = require('../services/apiKey.service');
const apiKeyUsageService = require('../services/apiKeyUsage.service');

class ApiKeyController {
  async createKey(req, res, next) {
    try {
      const { name, label, scopes, scope, expires_at, sandbox_mode } = req.body;
      const tenantId = req.tenant_id || req.user.tenant_id;
      const { apiKey, rawKey } = await apiKeyService.createApiKey(tenantId, req.user.id, {
        label: label || name,
        scopes,
        scope,
        expires_at,
        sandbox_mode
      });

      res.status(201).json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          label: apiKey.name,
          api_key: rawKey, // Shown only once
          key_prefix: apiKey.key_prefix,
          scopes: apiKey.scopes,
          sandbox_mode: apiKey.sandbox_mode,
          expires_at: apiKey.expires_at,
          warning: 'This is the only time the full API key will be shown. Store it securely.'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async listKeys(req, res, next) {
    try {
      const tenantId = req.tenant_id || req.user.tenant_id;
      const apiKeys = await apiKeyService.listApiKeys(tenantId);
      res.status(200).json({
        success: true,
        data: apiKeys.rows,
        total: apiKeys.count
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeKey(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.tenant_id || req.user.tenant_id;
      const updatedKey = await apiKeyService.revokeApiKey(id, tenantId);
      
      if (!updatedKey) {
        return res.status(404).json({ success: false, error: 'API Key not found or already revoked' });
      }

      res.status(200).json({
        success: true,
        data: updatedKey
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsageLogs(req, res, next) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const tenantId = req.tenant_id || req.user.tenant_id;

      const logs = await apiKeyUsageService.getUsageLogs(id, tenantId, { limit, offset });
      
      res.status(200).json({
        success: true,
        data: logs.rows,
        total: logs.count,
        page,
        limit
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ApiKeyController();
