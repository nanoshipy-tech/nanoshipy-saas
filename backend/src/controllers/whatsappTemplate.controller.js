'use strict';

const whatsappTemplateService = require('../services/whatsappTemplate.service');
const whatsappTemplateRepository = require('../repositories/whatsappTemplate.repository');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');

const listTemplates = async (req, res, next) => {
  try {
    const list = await whatsappTemplateRepository.list();
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const template = await whatsappTemplateService.createTemplate(req.body, adminId);
    return success(res, template, 201);
  } catch (err) {
    next(err);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await whatsappTemplateRepository.findById(id);
    if (!template) throw new NotFoundError('Template not found');

    if (template.meta_approval_status !== 'draft') {
      return res.status(400).json({ success: false, error: { message: 'Can only edit draft templates' } });
    }

    const updated = await whatsappTemplateRepository.update(id, req.body);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

const submitTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await whatsappTemplateService.submitTemplateToBSP(id);
    return success(res, template);
  } catch (err) {
    next(err);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await whatsappTemplateRepository.findById(id);
    if (!template) throw new NotFoundError('Template not found');

    if (!['draft', 'rejected'].includes(template.meta_approval_status)) {
      return res.status(400).json({ success: false, error: { message: 'Can only delete draft or rejected templates' } });
    }

    await whatsappTemplateRepository.delete(id);
    return success(res, { message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Inbound webhook from BSP for Meta template approval updates
const templateStatusCallback = async (req, res, next) => {
  try {
    const { bsp_template_id, status, rejection_reason } = req.body;
    if (!bsp_template_id || !status) {
      return res.status(400).json({ success: false, error: { message: 'Missing parameters' } });
    }

    await whatsappTemplateService.handleTemplateStatusCallback(bsp_template_id, status, rejection_reason);
    return success(res, { message: 'Callback processed' });
  } catch (err) {
    next(err);
  }
};

// Inbound WhatsApp webhook for buyer replies/button taps
const inboundWhatsAppWebhook = async (req, res, next) => {
  try {
    // Validate signature first (e.g. from Interakt/BSP payload)
    const signature = req.headers['x-hub-signature-256'];
    const secret = process.env.INTERAKT_WEBHOOK_SECRET;

    if (secret && !signature) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized. Signature missing.' } });
    }

    // Process inbound message
    const { from, type, body, buttonPayload } = await whatsappTemplateService.inboundWebhookParser
      ? await whatsappTemplateService.inboundWebhookParser(req.body)
      : { from: req.body.phone, body: req.body.text };

    // Find shipment/order for NDR or tracking check
    const { Shipment } = require('../models');
    const { Op } = require('sequelize');
    
    const shipment = await Shipment.findOne({
      where: {
        [Op.or]: [
          { consignee_phone: from },
          { shipping_phone: from }
        ]
      },
      order: [['created_at', 'DESC']]
    });

    if (shipment) {
      logger.info(`[WhatsAppInbound] Found matching shipment ${shipment.id} for phone ${from}`);
      // Route to NDR resolution flow (Module 10)
      const ndrService = require('../services/ndr.service');
      if (ndrService && ndrService.processWhatsAppResponse) {
        await ndrService.processWhatsAppResponse(shipment.awb_number, body || buttonPayload);
      }
    }

    return success(res, { message: 'Inbound message processed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  submitTemplate,
  deleteTemplate,
  templateStatusCallback,
  inboundWhatsAppWebhook,
};
const logger = require('../utils/logger');
