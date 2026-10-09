'use strict';

const shopifyIntegrationService = require('../services/shopifyIntegration.service');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const config = require('../config/env');

class ShopifyIntegrationController {
  /**
   * GET /api/integrations/shopify/status
   */
  async getStatus(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const data = await shopifyIntegrationService.getStatus(tenantId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/integrations/shopify/refresh-scopes
   */
  async refreshScopes(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const data = await shopifyIntegrationService.refreshScopes(tenantId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/integrations/shopify/disconnect
   */
  async disconnect(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const data = await shopifyIntegrationService.disconnect(tenantId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET/POST /api/integrations/shopify/oauth/authorize
   */
  async oauthAuthorize(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const shopDomain = req.query.shop || req.body?.shop;
      const clientId = req.query.client_id || req.body?.client_id;
      const clientSecret = req.query.client_secret || req.body?.client_secret;

      const result = await shopifyIntegrationService.buildOAuthAuthorizeUrl(
        tenantId,
        shopDomain,
        clientId,
        clientSecret
      );

      // If client requests JSON representation, return the URL
      if (req.query.format === 'json' || req.xhr || req.headers['content-type'] === 'application/json' || req.method === 'POST') {
        return success(res, result, 200);
      }

      // Otherwise, redirect directly to Shopify OAuth authorize page
      return res.redirect(result.authorize_url);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/integrations/shopify/oauth/callback
   */
  async oauthCallback(req, res, next) {
    const frontendBaseUrl = config.frontendUrl || 'https://app.nanoshipy.com';
    const redirectTarget = `${frontendBaseUrl.replace(/\/$/, '')}/integrations/shopify`;

    try {
      // Check if merchant denied the OAuth access or Shopify returned an error
      if (req.query.error) {
        const errorDesc = req.query.error_description || req.query.error;
        logger.warn(`[ShopifyOAuth] Shopify returned error in callback: ${errorDesc}`);
        return res.redirect(`${redirectTarget}?error=${encodeURIComponent(errorDesc)}`);
      }

      const { code, shop, state, hmac } = req.query;
      await shopifyIntegrationService.handleOAuthCallback({ code, shop, state, hmac });

      logger.info(`[ShopifyOAuth] Successfully completed OAuth connection for shop "${shop}"`);
      return res.redirect(`${redirectTarget}?connected=success&shop=${encodeURIComponent(shop || '')}`);
    } catch (err) {
      logger.error(`[ShopifyOAuth] Callback handling failed: ${err.message}`);
      return res.redirect(`${redirectTarget}?error=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * POST /api/integrations/shopify/manual-connect
   */
  async manualConnect(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { shop_domain, access_token, webhook_secret } = req.body;

      const data = await shopifyIntegrationService.manualConnect(tenantId, {
        shop_domain,
        access_token,
        webhook_secret,
      });

      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/integrations/shopify/sync
   */
  async syncOrders(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const data = await shopifyIntegrationService.syncOrders(tenantId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/integrations/shopify/orders
   */
  async getOrders(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { page, limit } = req.query;
      const data = await shopifyIntegrationService.getOrders(tenantId, { page, limit });
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/integrations/shopify/logs
   */
  async getLogs(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const data = await shopifyIntegrationService.getLogs(tenantId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/integrations/shopify/orders/:orderId/fulfill
   */
  async fulfillOrderManual(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { orderId } = req.params;
      const data = await shopifyIntegrationService.pushOrderFulfillment(tenantId, orderId);
      return success(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/integrations/shopify/webhooks/orders
   */
  async handleOrdersWebhook(req, res, next) {
    try {
      const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})));
      const hmacHeader = req.headers['x-shopify-hmac-sha256'];
      const shopDomainHeader = req.headers['x-shopify-shop-domain'];
      const topicHeader = req.headers['x-shopify-topic'] || req.query.topic;
      const isTestHeader = req.headers['x-shopify-test'];

      const result = await shopifyIntegrationService.verifyAndProcessWebhook({
        rawBody,
        hmacHeader,
        shopDomainHeader,
        topicHeader,
        isTest: isTestHeader === 'true' || Boolean(isTestHeader),
      });

      return res.status(result.status).json({
        success: result.status === 200,
        message: result.message,
      });
    } catch (err) {
      logger.error(`[ShopifyWebhook] Error processing order webhook: ${err.message}`, { error: err });
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Internal webhook error' });
      }
    }
  }
}

module.exports = new ShopifyIntegrationController();
