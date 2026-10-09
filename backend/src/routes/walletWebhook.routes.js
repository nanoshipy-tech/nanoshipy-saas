'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const paymentWebhookController = require('../controllers/paymentWebhook.controller');

// DEPRECATED ROUTE: /webhooks/razorpay
// Canonical endpoint: POST /api/v1/webhooks/payments/razorpay
router.post('/webhooks/razorpay', (req, res, next) => {
  logger.warn('[DEPRECATED_ROUTE] POST /webhooks/razorpay called. Please migrate to canonical endpoint: /api/v1/webhooks/payments/razorpay');
  req.params.provider = 'razorpay';
  return paymentWebhookController.handlePaymentWebhook(req, res, next);
});

module.exports = router;

