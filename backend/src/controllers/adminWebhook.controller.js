'use strict';

const { WebhookEndpoint, WebhookDelivery } = require('../models');
const webhookDispatcher = require('../services/webhookDispatcher.service');
const { validateWebhookUrl } = require('../utils/ssrfProtector.util');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

class AdminWebhookController {
  /**
   * GET /admin/webhooks
   * List all registered webhook endpoints for tenant.
   */
  async listEndpoints(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      if (!tenantId) {
        return error(res, { code: 'TENANT_REQUIRED', message: 'Tenant context required' }, 400);
      }

      const endpoints = await WebhookEndpoint.findAll({
        where: { tenant_id: tenantId },
        order: [['created_at', 'DESC']],
        attributes: [
          'id', 'tenant_id', 'url', 'events', 'is_active',
          'description', 'consecutive_failures', 'created_at', 'updated_at',
          // Note: secret is not returned in list to prevent leakage
        ],
      });

      return success(res, endpoints);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/webhooks
   * Create a new webhook endpoint. Reveals secret once.
   */
  async createEndpoint(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      if (!tenantId) {
        return error(res, { code: 'TENANT_REQUIRED', message: 'Tenant context required' }, 400);
      }

      const { url, events = ['export.completed', 'export.failed'], description } = req.body;

      if (!url) {
        return error(res, { code: 'INVALID_INPUT', message: 'Webhook target URL is required' }, 400);
      }

      // SSRF Validation
      const ssrfCheck = await validateWebhookUrl(url);
      if (!ssrfCheck.isValid) {
        return error(res, { code: 'INVALID_URL', message: `Invalid webhook URL: ${ssrfCheck.error}` }, 400);
      }

      const secret = webhookDispatcher.generateSecret();

      const endpoint = await WebhookEndpoint.create({
        tenant_id: tenantId,
        url: url.trim(),
        secret,
        events: Array.isArray(events) ? events : ['export.completed', 'export.failed'],
        description: description || null,
        is_active: true,
      });

      // Return secret once with explicit warning
      return res.status(201).json({
        success: true,
        data: {
          id: endpoint.id,
          url: endpoint.url,
          events: endpoint.events,
          description: endpoint.description,
          is_active: endpoint.is_active,
          secret,
          warning: 'Store this secret securely. It will not be shown again.',
          created_at: endpoint.created_at,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /admin/webhooks/:id
   * Update existing webhook endpoint.
   */
  async updateEndpoint(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;
      const { url, events, description, is_active } = req.body;

      const endpoint = await WebhookEndpoint.findOne({
        where: { id, tenant_id: tenantId },
      });

      if (!endpoint) {
        return error(res, { code: 'NOT_FOUND', message: 'Webhook endpoint not found' }, 404);
      }

      if (url && url !== endpoint.url) {
        const ssrfCheck = await validateWebhookUrl(url);
        if (!ssrfCheck.isValid) {
          return error(res, { code: 'INVALID_URL', message: `Invalid webhook URL: ${ssrfCheck.error}` }, 400);
        }
        endpoint.url = url.trim();
      }

      if (Array.isArray(events)) endpoint.events = events;
      if (description !== undefined) endpoint.description = description;
      if (typeof is_active === 'boolean') {
        endpoint.is_active = is_active;
        if (is_active) endpoint.consecutive_failures = 0; // reset failures on manual re-enable
      }

      await endpoint.save();

      return success(res, {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        description: endpoint.description,
        is_active: endpoint.is_active,
        consecutive_failures: endpoint.consecutive_failures,
        updated_at: endpoint.updated_at,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /admin/webhooks/:id
   */
  async deleteEndpoint(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const deleted = await WebhookEndpoint.destroy({
        where: { id, tenant_id: tenantId },
      });

      if (!deleted) {
        return error(res, { code: 'NOT_FOUND', message: 'Webhook endpoint not found' }, 404);
      }

      return success(res, { message: 'Webhook endpoint deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/webhooks/:id/rotate-secret
   * Generates new secret and reveals it once.
   */
  async rotateSecret(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const endpoint = await WebhookEndpoint.findOne({
        where: { id, tenant_id: tenantId },
      });

      if (!endpoint) {
        return error(res, { code: 'NOT_FOUND', message: 'Webhook endpoint not found' }, 404);
      }

      const newSecret = webhookDispatcher.generateSecret();
      endpoint.secret = newSecret;
      await endpoint.save();

      return success(res, {
        id: endpoint.id,
        secret: newSecret,
        warning: 'This is the new webhook secret. Store it securely; it will not be shown again.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/webhooks/:id/test
   * Sends a sample test event to verify endpoint connectivity.
   */
  async testEndpoint(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const endpoint = await WebhookEndpoint.findOne({
        where: { id, tenant_id: tenantId },
      });

      if (!endpoint) {
        return error(res, { code: 'NOT_FOUND', message: 'Webhook endpoint not found' }, 404);
      }

      const sampleData = {
        test: true,
        message: 'This is a test webhook notification from Nanoshipy.',
        ping_at: new Date().toISOString(),
      };

      const deliveries = await webhookDispatcher.emitWebhookEvent(tenantId, 'webhook.test', sampleData);

      return success(res, {
        message: 'Test event queued for dispatch to endpoint',
        delivery_id: deliveries[0]?.id || null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /admin/webhooks/:id/deliveries
   * Paginated delivery history for an endpoint.
   */
  async listDeliveries(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await WebhookDelivery.findAndCountAll({
        where: { endpoint_id: id, tenant_id: tenantId },
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      return success(res, {
        total: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
        deliveries: rows,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/webhooks/deliveries/:id/retry
   * Manually retry a specific delivery attempt.
   */
  async retryDelivery(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const delivery = await WebhookDelivery.findOne({
        where: { id, tenant_id: tenantId },
      });

      if (!delivery) {
        return error(res, { code: 'NOT_FOUND', message: 'Delivery record not found' }, 404);
      }

      await delivery.update({ status: 'pending', last_error: null });
      webhookDispatcher.executeDeliveryAttempt(delivery.id).catch((e) => {
        logger.warn(`[AdminWebhookController] Manual retry error: ${e.message}`);
      });

      return success(res, { message: 'Delivery retry initiated' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminWebhookController();
