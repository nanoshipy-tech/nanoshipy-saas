'use strict';

const whatsappTemplateRepository = require('../repositories/whatsappTemplate.repository');
const whatsappAdapterService = require('./whatsappAdapter.service');
const { WhatsappTemplate, Order } = require('../models');
const { TemplateNotApprovedError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class WhatsappTemplateService {
  async createTemplate(data, adminId) {
    // Validate category
    if (data.category && !['utility', 'authentication'].includes(data.category)) {
      // In shipping systems, prevent marketing template misuse for notifications
      throw new Error('Only utility and authentication templates are allowed for shipping notifications');
    }

    return whatsappTemplateRepository.create({
      ...data,
      created_by: adminId,
      meta_approval_status: 'draft',
    });
  }

  async submitTemplateToBSP(id) {
    const template = await whatsappTemplateRepository.findById(id);
    if (!template) throw new NotFoundError('Template not found');

    logger.info(`[WhatsappTemplateService] Submitting template ${template.name} to WhatsApp BSP`);
    
    // In a real system, we post to Interakt/Gupshup template creation API.
    // For now we simulate. We update status to 'submitted'.
    await template.update({
      meta_approval_status: 'submitted',
      submitted_at: new Date(),
    });

    return template;
  }

  async handleTemplateStatusCallback(bspTemplateId, metaStatus, rejectionReason = null) {
    const template = await WhatsappTemplate.findOne({ where: { bsp_template_id: bspTemplateId } });
    if (!template) return null;

    logger.info(`[WhatsappTemplateService] Meta callback for template ${template.name}: ${metaStatus}`);

    const updates = {
      meta_approval_status: metaStatus,
    };

    if (metaStatus === 'approved') {
      updates.approved_at = new Date();
    } else if (metaStatus === 'rejected') {
      updates.meta_rejection_reason = rejectionReason;
    }

    return template.update(updates);
  }

  async sendNotification(orderId, templateName, variables = []) {
    const order = await Order.findByPk(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const template = await whatsappTemplateRepository.findByName(templateName);
    if (!template) {
      logger.warn(`[WhatsappTemplateService] Template "${templateName}" not found. Falling back to SMS.`);
      return this.fallbackToSMS(order, templateName, variables);
    }

    // Check approval status
    if (template.meta_approval_status !== 'approved') {
      throw new TemplateNotApprovedError(`Cannot send template "${templateName}" because its approval status is "${template.meta_approval_status}"`);
    }

    // Check opt-in
    if (order.whatsapp_opted_in === false) {
      logger.info(`[WhatsappTemplateService] Buyer opted out of WhatsApp. Falling back to SMS for order ${orderId}`);
      return this.fallbackToSMS(order, templateName, variables);
    }

    // Send via WhatsApp
    try {
      const to = order.shipping_phone;
      const result = await whatsappAdapterService.sendTemplateMessage({
        to,
        templateName: template.name,
        language: template.language,
        variables,
      });

      return result;
    } catch (err) {
      logger.error(`[WhatsappTemplateService] WhatsApp transmission failed. Falling back to SMS: ${err.message}`);
      return this.fallbackToSMS(order, templateName, variables);
    }
  }

  async fallbackToSMS(order, templateName, variables) {
    logger.info(`[WhatsappTemplateService] Fallback to SMS triggered for order ${order.id}`);
    const smsService = require('./sms.service');
    if (smsService && smsService.sendSMS) {
      // Simulate sending SMS via SMS service
      return smsService.sendSMS(order.shipping_phone, `Shipping Update: order reference ${order.order_reference}`);
    }
    return { success: true, via: 'sms_fallback_mock' };
  }
}

module.exports = new WhatsappTemplateService();
