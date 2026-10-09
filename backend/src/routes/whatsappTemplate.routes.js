'use strict';

const express = require('express');
const router = express.Router();
const whatsappTemplateController = require('../controllers/whatsappTemplate.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

// Public webhook routes for WhatsApp callbacks
router.post('/webhooks/inbound', whatsappTemplateController.inboundWhatsAppWebhook);
router.post('/webhooks/template-status', whatsappTemplateController.templateStatusCallback);

// Admin-level whatsapp template library routes
router.get('/', isPlatformAdmin, canPlatform('platform_settings.manage'), whatsappTemplateController.listTemplates);
router.post('/', isPlatformAdmin, canPlatform('platform_settings.manage'), whatsappTemplateController.createTemplate);
router.put('/:id', isPlatformAdmin, canPlatform('platform_settings.manage'), whatsappTemplateController.updateTemplate);
router.post('/:id/submit', isPlatformAdmin, canPlatform('platform_settings.manage'), whatsappTemplateController.submitTemplate);
router.delete('/:id', isPlatformAdmin, canPlatform('platform_settings.manage'), whatsappTemplateController.deleteTemplate);

module.exports = router;
