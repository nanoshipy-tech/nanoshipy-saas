'use strict';

const crypto = require('crypto');
const { Queue } = require('bullmq');
const { connection } = require('../queues/connection');
const { Shipment, Order } = require('../models');
const logger = require('../utils/logger');

// Create the progression queue
const sandboxProgressionQueue = new Queue('sandbox-progression', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
});

class SandboxSimulatorService {
  generateFakeAWB() {
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `FAKE_${randomHex}`;
  }

  async bookSandboxShipment(shipmentId) {
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return null;

    logger.info(`[SandboxSimulator] Booking sandbox shipment ${shipmentId} with AWB ${shipment.awb_number}`);

    // Update status to SCH (Scheduled)
    await shipment.update({
      status: 'SCH',
      awb_number: shipment.awb_number || this.generateFakeAWB(),
    });

    // Enqueue step 0 (RPKP - Picked Up) with a delay of 30 seconds
    const delay = parseInt(process.env.DEVELOPER_API_SANDBOX_STATUS_DELAY_MS) || 10000; // default 10s for fast testing
    await sandboxProgressionQueue.add(
      'progress',
      { shipmentId, nextStepIndex: 0 },
      { delay }
    );

    return shipment;
  }
}

module.exports = new SandboxSimulatorService();
