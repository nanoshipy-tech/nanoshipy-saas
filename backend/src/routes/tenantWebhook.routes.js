'use strict';

const express = require('express');
const tenantWebhookController = require('../controllers/tenantWebhook.controller');
const { createWebhookSchema, updateWebhookSchema } = require('../validators/tenantWebhook.validator');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', can('webhook.view'), tenantWebhookController.listWebhooks);
router.post('/', can('webhook.manage'), validate(createWebhookSchema), tenantWebhookController.registerWebhook);
router.put('/:id', can('webhook.manage'), validate(updateWebhookSchema), tenantWebhookController.updateWebhook);
router.delete('/:id', can('webhook.manage'), tenantWebhookController.deleteWebhook);
router.post('/:id/test', can('webhook.manage'), tenantWebhookController.testPingWebhook);
router.get('/:id/deliveries', can('webhook.view'), tenantWebhookController.getDeliveries);

module.exports = router;
