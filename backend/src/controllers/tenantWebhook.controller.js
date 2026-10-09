'use strict';

const outboundWebhookService = require('../services/outboundWebhook.service');

class TenantWebhookController {
  async registerWebhook(req, res, next) {
    try {
      const { target_url, subscribed_events } = req.body;
      const result = await outboundWebhookService.registerWebhook(req.tenant_id, req.user_id, { target_url, subscribed_events });

      res.status(201).json({
        success: true,
        data: {
          id: result.webhook.id,
          target_url: result.webhook.target_url,
          subscribed_events: result.webhook.subscribed_events,
          is_active: result.webhook.is_active,
          secret: result.secret,
          warning: 'This is the only time the webhook secret will be shown. Store it securely to verify signatures.'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async listWebhooks(req, res, next) {
    try {
      const webhooks = await outboundWebhookService.listWebhooks(req.tenant_id);
      res.status(200).json({
        success: true,
        data: webhooks.rows,
        total: webhooks.count
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWebhook(req, res, next) {
    try {
      const { id } = req.params;
      const updatedWebhook = await outboundWebhookService.updateWebhook(id, req.tenant_id, req.body);
      
      if (!updatedWebhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' });
      }

      res.status(200).json({
        success: true,
        data: updatedWebhook
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteWebhook(req, res, next) {
    try {
      const { id } = req.params;
      const deletedCount = await outboundWebhookService.deleteWebhook(id, req.tenant_id);
      
      if (deletedCount === 0) {
        return res.status(404).json({ success: false, error: 'Webhook not found' });
      }

      res.status(200).json({ success: true, message: 'Webhook deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async testPingWebhook(req, res, next) {
    try {
      const { id } = req.params;
      const delivery = await outboundWebhookService.sendTestPing(id, req.tenant_id);
      
      res.status(202).json({
        success: true,
        message: 'Test ping queued for delivery',
        data: { delivery_id: delivery.id }
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeliveries(req, res, next) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const deliveries = await outboundWebhookService.getDeliveries(id, { limit, offset });
      
      res.status(200).json({
        success: true,
        data: deliveries.rows,
        total: deliveries.count,
        page,
        limit
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TenantWebhookController();
