'use strict';

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { createLimiter } = require('../middlewares/rateLimiter.middleware');

// Webhook-specific rate limiter: 300 requests per minute per IP
// (generous to courier servers pushing batches of tracking updates)
const webhookLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many webhook requests' } },
});

// Verification check for webhook URL validators (GET)
router.get('/:providerKey', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'active',
    provider: req.params.providerKey,
    message: `Nanoshipy inbound webhook receiver is active and ready for ${req.params.providerKey}`,
  });
});

// Inbound push webhook receiver (POST)
router.post('/:providerKey', webhookLimiter, webhookController.receiveWebhook);

module.exports = router;
