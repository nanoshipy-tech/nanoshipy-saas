'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { WebhookLog, Shipment, CourierProvider } = require('../models');
const { mapStatus: shipwayMapStatus } = require('../providers/shipway/shipwayResponseMapper');
const { mapStatus: delhiveryMapStatus } = require('../providers/delhivery/delhiveryResponseMapper');
const trackingService = require('../services/tracking.service');
const logger = require('../utils/logger');

/**
 * Extract AWB number and normalized events from raw webhook payload.
 * Returns null if the provider is unrecognized or payload is malformed.
 */
function parseWebhookPayload(providerKey, payload) {
  try {
    if (providerKey === 'shipway') {
      const data = payload?.shipment || payload?.data || payload?.track || payload || {};

      // Check for sample / test webhook
      if (payload?.sample || payload?.test || data?.sample || data?.test || payload?.status === 'sample' ||
          (!data.awb && !data.tracking_number && !data.awb_number && !data.waybill)) {
        return { isSample: true, message: 'Shipway sample / test webhook' };
      }

      const awb = data.awb || data.awb_number || data.tracking_number || data.waybill || data.waybill_number || data.shipment_id || data.airway_bill_number;
      if (!awb) return null;

      const rawStatus = data.current_status || data.status || data.shipment_status || data.event || '';
      const remark = data.remark || data.remarks || data.description || data.activity || data.scan_comment || (data.pod ? `POD: ${data.pod}` : null);

      const events = [{
        status: shipwayMapStatus(rawStatus),
        raw_status: rawStatus,
        location: data.location || data.city || data.hub || data.current_location || null,
        remark,
        event_timestamp: data.datetime || data.timestamp || data.event_time || data.updated_at || new Date().toISOString(),
      }];
      return { awb, events, orderId: data.order_id || payload.order_id || null };
    }

    if (providerKey === 'delhivery') {
      // Delhivery pushes: { waybill: '...', status: '...', updated_at: '...', location: '...' }
      const awb = payload.waybill || payload.awb_number;
      if (!awb) return null;
      const rawStatus = payload.status || '';
      const events = [{
        status: delhiveryMapStatus(rawStatus),
        raw_status: rawStatus,
        location: payload.location || payload.city || null,
        remark: payload.remarks || null,
        event_timestamp: payload.updated_at || payload.timestamp || new Date().toISOString(),
      }];
      return { awb, events };
    }

    // Mock provider for testing
    if (providerKey === 'mock') {
      const awb = payload.awb_number || payload.awb;
      if (!awb) return null;
      return {
        awb,
        events: [{
          status: payload.status || 'in_transit',
          raw_status: payload.raw_status || payload.status || 'in_transit',
          location: payload.location || 'Test City',
          remark: payload.remark || null,
          event_timestamp: payload.timestamp || new Date().toISOString(),
        }],
      };
    }

    return null;
  } catch (err) {
    logger.error(`[WebhookWorker] Failed to parse payload for ${providerKey}:`, { error: err.message });
    return null;
  }
}

const webhookProcessWorker = new Worker(
  'webhook-process',
  async (job) => {
    const { webhookLogId } = job.data;
    logger.info(`[WebhookWorker] Processing job ${job.id} for webhookLog ${webhookLogId}`);

    const webhookLog = await WebhookLog.findByPk(webhookLogId, {
      include: [{ model: CourierProvider, as: 'provider', scope: false }],
    });

    if (!webhookLog) {
      logger.warn(`[WebhookWorker] WebhookLog ${webhookLogId} not found — skipping`);
      return;
    }

    if (!webhookLog.signature_valid) {
      await webhookLog.update({
        processed: true,
        processed_at: new Date(),
        processing_error: 'Signature verification failed — payload rejected',
      });
      return;
    }

    const providerKey = webhookLog.provider?.provider_key;
    if (!providerKey) {
      await webhookLog.update({
        processed: true,
        processed_at: new Date(),
        processing_error: 'Unknown provider — cannot parse payload',
      });
      return;
    }

    const parsed = parseWebhookPayload(providerKey, webhookLog.payload);
    if (!parsed) {
      await webhookLog.update({
        processed: true,
        processed_at: new Date(),
        processing_error: 'Payload parsing failed — missing AWB or unrecognized format',
      });
      return;
    }

    if (parsed.isSample) {
      await webhookLog.update({
        processed: true,
        processed_at: new Date(),
        processing_error: null,
      });
      logger.info(`[WebhookWorker] Successfully acknowledged sample webhook ${webhookLogId} for ${providerKey}`);
      return;
    }

    // Look up shipment by AWB, courier_shipment_id, or parent order
    let shipment = await Shipment.findOne({ where: { awb_number: parsed.awb } });
    if (!shipment) {
      shipment = await Shipment.findOne({ where: { courier_shipment_id: parsed.awb } });
    }
    if (!shipment && parsed.orderId) {
      const { Order } = require('../models');
      const parentOrder = await Order.findOne({ where: { order_reference: parsed.orderId } });
      if (parentOrder) {
        shipment = await Shipment.findOne({ where: { order_id: parentOrder.id } });
      }
    }

    if (!shipment) {
      await webhookLog.update({
        processed: true,
        processed_at: new Date(),
        processing_error: `Shipment not found for AWB: ${parsed.awb}`,
      });
      return;
    }

    // Ingest events
    await trackingService.ingestTrackingEvents(shipment.id, parsed.events, 'webhook');

    await webhookLog.update({
      processed: true,
      processed_at: new Date(),
      processing_error: null,
    });

    logger.info(`[WebhookWorker] Successfully processed webhookLog ${webhookLogId} for AWB ${parsed.awb}`);
  },
  {
    connection,
    concurrency: 5,
  },
);

webhookProcessWorker.on('failed', async (job, err) => {
  logger.error(`[WebhookWorker] Job ${job?.id} failed:`, { error: err.message });
  if (job?.data?.webhookLogId) {
    try {
      await WebhookLog.update(
        { processing_error: err.message.slice(0, 490) },
        { where: { id: job.data.webhookLogId } },
      );
    } catch (_) {}
  }
});

webhookProcessWorker.on('error', (err) => {
  logger.error('[WebhookWorker] Worker error:', { error: err.message });
});

module.exports = webhookProcessWorker;
