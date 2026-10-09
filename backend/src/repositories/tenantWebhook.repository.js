'use strict';

const { TenantWebhook } = require('../models');

class TenantWebhookRepository {
  async create(data, transaction) {
    return TenantWebhook.create(data, { transaction });
  }

  async findById(id, tenantId) {
    return TenantWebhook.findOne({
      where: { id, tenant_id: tenantId },
    });
  }

  async listByTenant(tenantId, options = {}) {
    return TenantWebhook.findAndCountAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async findActiveByEvent(eventKey) {
    // Requires a JSON contains query or we can fetch all active webhooks for all tenants and filter.
    // Assuming subscribed_events is an array in JSON.
    // For large scale, we should optimize, but for now we'll query active ones and filter in code or use JSON_CONTAINS.
    const { Op } = require('sequelize');
    const { sequelize } = require('../models');
    
    // Using a raw query for JSON array contains across postgres and mysql can vary.
    // Sequelize provides Op.contains for Postgres array/jsonb but not all backends.
    // For simplicity and assuming postgres due to previous migrations:
    return TenantWebhook.findAll({
      where: {
        is_active: true,
        subscribed_events: {
          [Op.contains]: [eventKey]
        }
      }
    });
  }

  async update(id, tenantId, data, transaction) {
    const [updatedRows, [updatedWebhook]] = await TenantWebhook.update(data, {
      where: { id, tenant_id: tenantId },
      returning: true,
      transaction,
    });
    return updatedRows > 0 ? updatedWebhook : null;
  }

  async updateDeliveryStatus(id, status, transaction) {
    await TenantWebhook.update({ last_delivery_status: status }, {
      where: { id },
      transaction
    });
  }
  
  async delete(id, tenantId) {
    return TenantWebhook.destroy({
      where: { id, tenant_id: tenantId }
    });
  }
}

module.exports = new TenantWebhookRepository();
