'use strict';

const express = require('express');
const shopifyIntegrationController = require('../controllers/shopifyIntegration.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { shopifyManualConnectLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

// Shared status, scope verification, and disconnection
router.get('/status', authenticate, (req, res, next) => shopifyIntegrationController.getStatus(req, res, next));
router.post('/refresh-scopes', authenticate, (req, res, next) => shopifyIntegrationController.refreshScopes(req, res, next));
router.delete('/disconnect', authenticate, (req, res, next) => shopifyIntegrationController.disconnect(req, res, next));

// Option A: OAuth Flow (Supports GET and POST for custom client credentials)
router.get('/oauth/authorize', authenticate, (req, res, next) => shopifyIntegrationController.oauthAuthorize(req, res, next));
router.post('/oauth/authorize', authenticate, (req, res, next) => shopifyIntegrationController.oauthAuthorize(req, res, next));
router.get('/oauth/callback', (req, res, next) => shopifyIntegrationController.oauthCallback(req, res, next));

// Option B: Manual Access Token Connection (Rate-limited to prevent token-guessing)
router.post('/manual-connect', authenticate, shopifyManualConnectLimiter, (req, res, next) => shopifyIntegrationController.manualConnect(req, res, next));

// On-demand sync, order feed, and fulfillment push
router.post('/sync', authenticate, (req, res, next) => shopifyIntegrationController.syncOrders(req, res, next));
router.get('/orders', authenticate, (req, res, next) => shopifyIntegrationController.getOrders(req, res, next));
router.post('/orders/:orderId/fulfill', authenticate, (req, res, next) => shopifyIntegrationController.fulfillOrderManual(req, res, next));
router.get('/logs', authenticate, (req, res, next) => shopifyIntegrationController.getLogs(req, res, next));

// Inbound Webhook: Order events receiver
// Raw body preserved for HMAC validation
router.post('/webhooks/orders', express.raw({ type: '*/*' }), (req, res, next) => shopifyIntegrationController.handleOrdersWebhook(req, res, next));

module.exports = router;
