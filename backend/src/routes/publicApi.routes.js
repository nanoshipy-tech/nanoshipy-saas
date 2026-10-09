'use strict';

const express = require('express');
const { apiKeyAuth, requireScope } = require('../middlewares/apiKeyAuth.middleware');
const apiKeyRateLimiter = require('../middlewares/apiKeyRateLimit.middleware');
const publicApiController = require('../controllers/publicApi.controller');

const router = express.Router();

// Apply rate limiting to all public endpoints
router.use(apiKeyRateLimiter);

// Protect with API Key Auth
router.use(...apiKeyAuth);

// Adapter middleware to ensure compatibility with publicApiController
router.use((req, res, next) => {
  req.tenantId = req.tenant_id;
  req.sandboxMode = false;
  if (!req.apiKey) {
    req.apiKey = { created_by: null };
  }
  next();
});

router.get('/orders', requireScope('orders.read'), (req, res, next) => publicApiController.listOrders(req, res, next));
router.post('/orders', requireScope('orders.write'), (req, res, next) => publicApiController.createOrder(req, res, next));
router.get('/orders/:orderId', requireScope('orders.read'), (req, res, next) => publicApiController.getOrder(req, res, next));
router.post('/orders/:orderId/cancel', requireScope('orders.write'), (req, res, next) => publicApiController.cancelOrder(req, res, next));

router.get('/rates', (req, res, next) => publicApiController.getRates(req, res, next));
router.get('/serviceability', (req, res, next) => publicApiController.getServiceability(req, res, next));
router.get('/tracking/:awb', (req, res, next) => publicApiController.getTracking(req, res, next));

module.exports = router;
