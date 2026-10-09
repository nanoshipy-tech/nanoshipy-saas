'use strict';
const express = require('express');
const router = express.Router();
const c = require('../controllers/paymentWebhook.controller');

// Public server-to-server webhook endpoint (no auth middleware, signature verified internally)
router.post('/payments/:provider', c.handlePaymentWebhook);

// Deprecated / backward-compatibility endpoint: POST /api/v1/webhooks/razorpay
router.post('/razorpay', (req, res, next) => {
  const logger = require('../utils/logger');
  logger.warn('[DEPRECATED_ROUTE] POST /api/v1/webhooks/razorpay called. Please migrate to canonical endpoint: /api/v1/webhooks/payments/razorpay');
  req.params.provider = 'razorpay';
  return c.handlePaymentWebhook(req, res, next);
});

module.exports = router;
