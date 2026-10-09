'use strict';

const { WebhookDelivery } = require('../models');

class WebhookDeliveryRepository {
  async create(data, transaction) {
    return WebhookDelivery.create(data, { transaction });
  }

  async findById(id) {
    return WebhookDelivery.findByPk(id);
  }

  async update(id, data, transaction) {
    const [updatedRows, [updatedDelivery]] = await WebhookDelivery.update(data, {
      where: { id },
      returning: true,
      transaction,
    });
    return updatedRows > 0 ? updatedDelivery : null;
  }

  async listByWebhookId(tenantWebhookId, options = {}) {
    return WebhookDelivery.findAndCountAll({
      where: { tenant_webhook_id: tenantWebhookId },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }
}

module.exports = new WebhookDeliveryRepository();
