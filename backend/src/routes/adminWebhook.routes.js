'use strict';

const express = require('express');
const adminWebhookController = require('../controllers/adminWebhook.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

router.use(authenticate);

// Delivery retry route mounted before parameter routes
router.post('/deliveries/:id/retry', can('webhook.manage'), adminWebhookController.retryDelivery);

// Webhook endpoint management
router.get('/', can('webhook.view'), adminWebhookController.listEndpoints);
router.post('/', can('webhook.manage'), adminWebhookController.createEndpoint);
router.put('/:id', can('webhook.manage'), adminWebhookController.updateEndpoint);
router.delete('/:id', can('webhook.manage'), adminWebhookController.deleteEndpoint);

// Secret rotation & testing
router.post('/:id/rotate-secret', can('webhook.manage'), adminWebhookController.rotateSecret);
router.post('/:id/test', can('webhook.manage'), adminWebhookController.testEndpoint);

// Delivery log
router.get('/:id/deliveries', can('webhook.view'), adminWebhookController.listDeliveries);

module.exports = router;
