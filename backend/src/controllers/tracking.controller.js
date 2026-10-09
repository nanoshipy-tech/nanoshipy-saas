'use strict';

const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const trackingService = require('../services/tracking.service');
const trackingPollQueue = require('../queues/trackingPoll.queue');
const { Shipment } = require('../models');

/**
 * GET /api/v1/shipments/:id/tracking
 * Returns the full tracking event timeline for a tenant-scoped shipment.
 */
const getShipmentTracking = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const timeline = await trackingService.getTrackingTimeline(id, tenantId);

    if (!timeline) {
      throw new NotFoundError('Shipment not found');
    }

    return success(res, timeline);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/shipments/:id/tracking/poll
 * Manually trigger a tracking refresh for a shipment.
 * Rate-limited at the route level (5 per 15 min per shipment+tenant).
 */
const triggerManualPoll = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const shipment = await Shipment.findOne({
      where: { id, tenant_id: tenantId },
      attributes: ['id', 'awb_number', 'status'],
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    if (!shipment.awb_number) {
      return success(res, { queued: false, reason: 'No AWB number assigned yet' });
    }

    // Use a unique jobId to prevent duplicate poll jobs for the same shipment
    await trackingPollQueue.add(
      `manual-poll-${id}`,
      { shipmentId: id },
      {
        jobId: `manual-poll-${id}-${Date.now()}`,
        priority: 1, // High priority vs scheduled polls
      },
    );

    return success(res, { queued: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getShipmentTracking, triggerManualPoll };
