'use strict';

const express = require('express');
const router = express.Router();
const whatsappWebhookController = require('../controllers/whatsappWebhook.controller');

// Public webhook endpoints for Growax CRM and Meta WhatsApp
router.get('/webhook', whatsappWebhookController.verifyWebhook);
router.post('/webhook', whatsappWebhookController.handleWebhook);

module.exports = router;
