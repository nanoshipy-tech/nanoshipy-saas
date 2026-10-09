'use strict';

const apiKeyRepository = require('../repositories/apiKey.repository');
const logger = require('../utils/logger');

class ApiKeyUsageService {
  async logUsage(apiKeyId, req, res, responseTimeMs) {
    try {
      await apiKeyRepository.logUsage({
        api_key_id: apiKeyId,
        endpoint: req.originalUrl || req.url,
        method: req.method,
        status_code: res.statusCode,
        response_time_ms: responseTimeMs,
        ip_address: req.ip || req.connection.remoteAddress,
      });
    } catch (error) {
      // Don't throw an error for usage logging failure, just log it.
      logger.error('[ApiKeyUsageService] Failed to log usage:', { error: error.message });
    }
  }

  async getUsageLogs(apiKeyId, tenantId, options) {
    // Verify the key belongs to the tenant first
    const key = await apiKeyRepository.findById(apiKeyId, tenantId);
    if (!key) {
      throw new Error('API key not found');
    }
    return apiKeyRepository.getUsageLogs(apiKeyId, options);
  }
}

module.exports = new ApiKeyUsageService();
