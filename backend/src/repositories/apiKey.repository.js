'use strict';

const { ApiKey, ApiKeyUsageLog } = require('../models');

class ApiKeyRepository {
  async create(data, transaction) {
    return ApiKey.create(data, { transaction });
  }

  async findById(id, tenantId) {
    return ApiKey.findOne({
      where: { id, tenant_id: tenantId },
    });
  }

  async findByHash(keyHash) {
    return ApiKey.findOne({
      where: { key_hash: keyHash, is_active: true },
    });
  }

  async listByTenant(tenantId, options = {}) {
    return ApiKey.findAndCountAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async update(id, tenantId, data) {
    const [updatedRows, [updatedApiKey]] = await ApiKey.update(data, {
      where: { id, tenant_id: tenantId },
      returning: true,
    });
    return updatedRows > 0 ? updatedApiKey : null;
  }

  async logUsage(data) {
    return ApiKeyUsageLog.create(data);
  }

  async getUsageLogs(apiKeyId, options = {}) {
    return ApiKeyUsageLog.findAndCountAll({
      where: { api_key_id: apiKeyId },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }
}

module.exports = new ApiKeyRepository();
