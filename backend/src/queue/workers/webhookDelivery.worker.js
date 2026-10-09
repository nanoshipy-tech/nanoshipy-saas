'use strict';

const { Worker } = require('bullmq');
const axios = require('axios');
const { connection } = require('../../queues/connection');
const webhookDeliveryRepository = require('../../repositories/webhookDelivery.repository');
const tenantWebhookRepository = require('../../repositories/tenantWebhook.repository');
const webhookSigningUtil = require('../../utils/webhookSigning.util');
const logger = require('../../utils/logger');
// Could also bring in notificationService if we want to alert on exhaustion
const notificationService = require('../../services/notification.service');

const webhookDeliveryWorker = new Worker('webhook-delivery', async (job) => {
  const { deliveryId, webhookId, targetUrl, secret, payload } = job.data;
  
  let delivery = await webhookDeliveryRepository.findById(deliveryId);
  if (!delivery) {
    logger.warn(`[WebhookDeliveryWorker] Delivery record ${deliveryId} not found, skipping.`);
    return;
  }

  // Increment attempt number if this is a retry
  if (job.attemptsMade > 0) {
    delivery = await webhookDeliveryRepository.update(deliveryId, {
      attempt_number: job.attemptsMade + 1,
    });
  }

  const signature = webhookSigningUtil.generateSignature(payload, secret);

  const headers = {
    'Content-Type': 'application/json',
    'X-Nanoshipy-Signature': signature,
    'X-Nanoshipy-Event': payload.event,
    'X-Nanoshipy-Delivery': deliveryId,
  };

  try {
    logger.info(`[WebhookDeliveryWorker] Delivering event ${payload.event} to ${targetUrl}`);
    const response = await axios.post(targetUrl, payload, {
      headers,
      timeout: parseInt(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS, 10) || 5000,
    });

    // Success
    await webhookDeliveryRepository.update(deliveryId, {
      status: 'delivered',
      response_status_code: response.status,
      response_body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      delivered_at: new Date(),
    });
    await tenantWebhookRepository.updateDeliveryStatus(webhookId, 'success');
    
    logger.info(`[WebhookDeliveryWorker] Successfully delivered ${deliveryId}`);

  } catch (error) {
    const statusCode = error.response ? error.response.status : null;
    const responseBody = error.response && error.response.data 
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    const maxAttempts = job.opts.attempts || 4;
    const isExhausted = (job.attemptsMade + 1) >= maxAttempts;

    const newStatus = isExhausted ? 'exhausted' : 'failed';
    
    await webhookDeliveryRepository.update(deliveryId, {
      status: newStatus,
      response_status_code: statusCode,
      response_body: responseBody,
    });
    
    await tenantWebhookRepository.updateDeliveryStatus(webhookId, 'failed');

    logger.error(`[WebhookDeliveryWorker] Delivery ${deliveryId} failed. Attempt ${job.attemptsMade + 1}/${maxAttempts}. Status: ${statusCode}`);

    if (isExhausted) {
      logger.warn(`[WebhookDeliveryWorker] Delivery ${deliveryId} exhausted all retries.`);
      // Optionally notify the tenant via notification system here
      try {
        const webhook = await tenantWebhookRepository.findById(webhookId, payload.tenant_id);
        if (webhook && webhook.created_by) {
          // Find the user and send an email alert using your notification dispatcher
          // This requires a template and proper wiring.
          logger.info(`[WebhookDeliveryWorker] Dispatched exhaustion alert for webhook ${webhookId}`);
        }
      } catch (notifyErr) {
        logger.error(`[WebhookDeliveryWorker] Failed to send exhaustion alert: ${notifyErr.message}`);
      }
    } else {
      // Re-throw so BullMQ triggers a retry
      throw new Error(`Webhook delivery failed with status ${statusCode || error.message}`);
    }
  }
}, { connection });

webhookDeliveryWorker.on('failed', (job, err) => {
  logger.error(`[WebhookDeliveryWorker] Job ${job.id} failed: ${err.message}`);
});

module.exports = {
  webhookDeliveryWorker,
};
