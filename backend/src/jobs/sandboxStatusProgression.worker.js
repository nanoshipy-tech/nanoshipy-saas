'use strict';

const { Worker, Queue } = require('bullmq');
const { connection } = require('../queues/connection');
const trackingService = require('../services/tracking.service');
const { Shipment, Tenant } = require('../models');
const logger = require('../utils/logger');

const sandboxProgressionQueue = new Queue('sandbox-progression', { connection });

const steps = [
  { status: 'RPKP', label: 'Picked Up', delay: 10000 }, // RPKP
  { status: 'INT', label: 'In Transit', delay: 10000 },  // INT
  { status: 'OOD', label: 'Out For Delivery', delay: 10000 }, // OOD
  { status: 'DEL', label: 'Delivered', delay: 0 }      // DEL / UND
];

const sandboxStatusProgressionWorker = new Worker(
  'sandbox-progression',
  async (job) => {
    const { shipmentId, nextStepIndex } = job.data;
    logger.info(`[SandboxWorker] Processing job for shipment ${shipmentId}, step index ${nextStepIndex}`);

    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) {
      logger.warn(`[SandboxWorker] Shipment ${shipmentId} not found`);
      return;
    }

    const currentStep = steps[nextStepIndex];
    if (!currentStep) return;

    let targetStatus = currentStep.status;
    let targetLabel = currentStep.label;

    if (nextStepIndex === 3) {
      // Step 3 (Final state): Check if tenant has auto_ndr_on_sandbox enabled
      const tenant = await Tenant.findByPk(shipment.tenant_id);
      if (tenant && tenant.auto_ndr_on_sandbox) {
        targetStatus = 'UND';
        targetLabel = 'Undelivered (NDR)';
      }
    }

    logger.info(`[SandboxWorker] Transitioning shipment ${shipmentId} to ${targetStatus}`);

    // Ingest tracking event to trigger history logs and event notifications
    await trackingService.ingestTrackingEvents(
      shipmentId,
      [
        {
          status: targetStatus,
          raw_status: targetLabel,
          location: 'Sandbox Sorting Hub',
          remark: `Simulated tracking status: ${targetLabel}`,
          event_timestamp: new Date(),
        },
      ],
      'webhook'
    );

    // Schedule next step if available
    if (nextStepIndex < 3) {
      const nextDelay = parseInt(process.env.DEVELOPER_API_SANDBOX_STATUS_DELAY_MS) || currentStep.delay;
      await sandboxProgressionQueue.add(
        'progress',
        { shipmentId, nextStepIndex: nextStepIndex + 1 },
        { delay: nextDelay }
      );
      logger.info(`[SandboxWorker] Enqueued next status step ${nextStepIndex + 1} with delay ${nextDelay}ms`);
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

sandboxStatusProgressionWorker.on('failed', (job, err) => {
  logger.error(`[SandboxWorker] Job ${job?.id} failed: ${err.message}`);
});

module.exports = sandboxStatusProgressionWorker;
