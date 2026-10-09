'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { Shipment, CourierProvider } = require('../models');
const ProviderFactory = require('../providers/ProviderFactory');
const providerCredentialService = require('../services/providerCredential.service');
const trackingService = require('../services/tracking.service');
const logger = require('../utils/logger');

const trackingPollWorker = new Worker(
  'tracking-poll',
  async (job) => {
    const { shipmentId } = job.data;
    logger.info(`[PollWorker] Polling tracking for shipment ${shipmentId}`);

    const shipment = await Shipment.findByPk(shipmentId, {
      include: [
        {
          model: CourierProvider,
          as: 'provider',
          // Use the withCredentials scope to get credentials_encrypted
          scope: false,
          attributes: ['id', 'provider_key', 'credentials_encrypted', 'config', 'sandbox_mode'],
        },
      ],
    });

    if (!shipment) {
      logger.warn(`[PollWorker] Shipment ${shipmentId} not found — skipping`);
      return;
    }

    if (!shipment.awb_number) {
      logger.warn(`[PollWorker] Shipment ${shipmentId} has no AWB — skipping`);
      return;
    }

    const provider = shipment.provider;
    if (!provider) {
      logger.warn(`[PollWorker] Shipment ${shipmentId} has no provider — skipping`);
      return;
    }

    // Decrypt credentials
    const credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
    const config = { ...provider.config, sandbox_mode: provider.sandbox_mode };

    const adapter = await ProviderFactory.getAdapter(
      provider.provider_key,
      credentials,
      config,
      provider.id,
    );

    const result = await adapter.trackShipment({ awbNumber: shipment.awb_number });

    if (!result.ok) {
      logger.warn(`[PollWorker] Tracking poll failed for ${shipment.awb_number}: ${result.error?.message}`);
      return;
    }

    const { history } = result.data;

    if (!Array.isArray(history) || history.length === 0) {
      logger.info(`[PollWorker] No history returned for AWB ${shipment.awb_number}`);
      return;
    }

    // Normalize events (adapter returns already-mapped statuses)
    const events = history.map(h => ({
      status: h.status,
      raw_status: h.status, // adapter has already mapped; store as both
      location: h.location || null,
      remark: h.remark || null,
      event_timestamp: h.timestamp || new Date().toISOString(),
    }));

    // Also include current status
    events.push({
      status: result.data.status,
      raw_status: result.data.status,
      location: result.data.currentLocation || null,
      remark: null,
      event_timestamp: new Date().toISOString(),
    });

    await trackingService.ingestTrackingEvents(shipment.id, events, 'poll');

    logger.info(`[PollWorker] Successfully polled ${events.length} events for AWB ${shipment.awb_number}`);
  },
  {
    connection,
    concurrency: 3,
  },
);

trackingPollWorker.on('failed', (job, err) => {
  logger.error(`[PollWorker] Job ${job?.id} failed for shipment ${job?.data?.shipmentId}:`, {
    error: err.message,
  });
});

trackingPollWorker.on('error', (err) => {
  logger.error('[PollWorker] Worker error:', { error: err.message });
});

module.exports = trackingPollWorker;
