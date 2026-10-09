'use strict';

const { TrackingEvent, Shipment, NdrEvent, RtoRecord, sequelize } = require('../models');
const { detectNdrReason, detectRtoStatus, REASON_CODES, RTO_STATUSES } = require('../constants/ndrReasonCodes.constant');
const config = require('../config/env');
const settingsService = require('./settings.service');
const shipmentStatusService = require('./shipmentStatus.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');

/**
 * Runs NDR or RTO detection checks on a single tracking event.
 * Runs in the background queue.
 *
 * @param {string} trackingEventId
 */
async function detectAndProcessNdrOrRto(trackingEventId) {
  const event = await TrackingEvent.findByPk(trackingEventId, {
    include: [
      {
        model: Shipment,
        as: 'shipment',
      },
    ],
  });

  if (!event) {
    logger.warn(`[NdrDetection] TrackingEvent ${trackingEventId} not found`);
    return;
  }

  const shipment = event.shipment;
  if (!shipment) {
    logger.warn(`[NdrDetection] TrackingEvent ${trackingEventId} has no associated shipment`);
    return;
  }

  const txn = await sequelize.transaction();

  try {
    // 1. Check if the event is a reverse logistics (RTO) event
    const rtoStatus = detectRtoStatus(event.status, event.remark);
    if (rtoStatus) {
      await handleRtoEvent(event, rtoStatus, txn);
      await txn.commit();
      return;
    }

    // 2. Check if the event is an NDR event
    const ndrReason = detectNdrReason(event.status, event.remark);
    if (ndrReason) {
      await handleNdrEvent(event, ndrReason, txn);
      await txn.commit();
      return;
    }

    // 3. Check if the event is a successful delivery that resolves an open NDR
    if (event.status === 'delivered') {
      await resolveOpenNdr(shipment.id, 'resolved_delivered', txn);
    }

    await txn.commit();
  } catch (err) {
    await txn.rollback();
    logger.error(`[NdrDetection] Failed to process tracking event ${trackingEventId}:`, {
      error: err.message,
    });
    throw err;
  }
}

/**
 * Handle a detected NDR condition.
 */
async function handleNdrEvent(event, reasonCode, transaction) {
  const shipment = event.shipment;
  // Retrofit (Module 18): use three-tier settings resolution instead of direct env read.
  // Falls back to platform_settings.default_ndr_auto_rto_threshold → env NDR_AUTO_RTO_THRESHOLD.
  const { value: threshold } = await settingsService.getEffectiveSetting(shipment.tenant_id, 'ndr_auto_rto_threshold');
  const slaHours = config.ndr.slaHours;

  // Check if there is an existing open NDR event for this shipment
  let ndr = await NdrEvent.findOne({
    where: {
      shipment_id: shipment.id,
      status: 'open',
    },
    transaction,
  });

  if (ndr) {
    // Increment attempts
    const newAttempt = ndr.attempt_number + 1;

    if (newAttempt > threshold) {
      // Exceeded attempts threshold -> Auto-trigger RTO!
      logger.info(`[NdrDetection] Shipment ${shipment.id} exceeded NDR attempts threshold (${threshold}). Auto-triggering RTO.`);

      // 1. Resolve NDR as RTO resolved
      await ndr.update(
        {
          attempt_number: newAttempt,
          status: 'resolved_rto',
          tracking_event_id: event.id,
        },
        { transaction },
      );

      // 2. Create RTO record
      await RtoRecord.create(
        {
          tenant_id: shipment.tenant_id,
          shipment_id: shipment.id,
          initiated_reason: `Surpassed maximum delivery attempt threshold (${threshold} attempts)`,
          initiated_by: 'auto_ndr_threshold',
          status: RTO_STATUSES.RTO_INITIATED,
        },
        { transaction },
      );

      // 3. Update shipment status to cancelled (treating RTO as parallel tracking but changing shipment status)
      const oldStatus = shipment.status;
      if (oldStatus !== 'cancelled') {
        await shipment.update({ status: 'cancelled' }, { transaction });
        await shipmentStatusService.logHistory(
          shipment.id,
          oldStatus,
          'cancelled',
          'system',
          `Auto-RTO initiated after ${threshold} failed attempts.`,
          transaction,
        );
      }

      await auditService.log({
        action: 'rto_initiated',
        tenant_id: shipment.tenant_id,
        entity_type: 'shipment',
        entity_id: shipment.id,
        metadata: { reason: 'auto_ndr_threshold', attempts: newAttempt },
      });
    } else {
      // Just update attempts count
      await ndr.update(
        {
          attempt_number: newAttempt,
          tracking_event_id: event.id,
        },
        { transaction },
      );
      logger.info(`[NdrDetection] Shipment ${shipment.id} NDR attempt incremented to ${newAttempt}`);
    }
  } else {
    // Create new open NDR event
    const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);
    await NdrEvent.create(
      {
        tenant_id: shipment.tenant_id,
        shipment_id: shipment.id,
        tracking_event_id: event.id,
        reason_code: reasonCode,
        raw_reason: event.remark || event.status,
        attempt_number: 1,
        status: 'open',
        sla_due_at: slaDueAt,
      },
      { transaction },
    );

    // Call notification event hook (stub)
    onNdrCreated(shipment.id, reasonCode);

    logger.info(`[NdrDetection] Created new open NDR for shipment ${shipment.id} (Reason: ${reasonCode})`);
  }
}

/**
 * Handle a detected RTO (Return to Origin) event.
 */
async function handleRtoEvent(event, rtoStatus, transaction) {
  const shipment = event.shipment;

  let rto = await RtoRecord.findOne({
    where: { shipment_id: shipment.id },
    transaction,
  });

  if (rto) {
    const oldStatus = rto.status;
    const updateData = { status: rtoStatus };

    if (rtoStatus === RTO_STATUSES.RTO_DELIVERED) {
      updateData.received_at_warehouse_at = new Date();
    }

    await rto.update(updateData, { transaction });

    await auditService.log({
      action: 'rto_status_updated',
      tenant_id: shipment.tenant_id,
      entity_type: 'rto_record',
      entity_id: rto.id,
      metadata: { old_status: oldStatus, new_status: rtoStatus },
    });

    logger.info(`[NdrDetection] Updated RTO status to ${rtoStatus} for shipment ${shipment.id}`);
  } else {
    // Courier-initiated RTO (first time seeing RTO event)
    rto = await RtoRecord.create(
      {
        tenant_id: shipment.tenant_id,
        shipment_id: shipment.id,
        initiated_reason: `Courier reverse logistics status: ${event.status}`,
        initiated_by: 'courier_initiated',
        status: rtoStatus,
      },
      { transaction },
    );

    // Call notification hook (stub)
    onRtoInitiated(shipment.id, 'courier_initiated');

    await auditService.log({
      action: 'rto_initiated',
      tenant_id: shipment.tenant_id,
      entity_type: 'shipment',
      entity_id: shipment.id,
      metadata: { reason: 'courier_initiated', rto_status: rtoStatus },
    });

    logger.info(`[NdrDetection] Created courier-initiated RTO for shipment ${shipment.id}`);
  }

  // If RTO is delivered, resolve any open NDR and update shipment status
  if (rtoStatus === RTO_STATUSES.RTO_DELIVERED) {
    await resolveOpenNdr(shipment.id, 'resolved_rto', transaction);

    const oldShipmentStatus = shipment.status;
    if (oldShipmentStatus !== 'cancelled') {
      await shipment.update({ status: 'cancelled' }, { transaction });
      await shipmentStatusService.logHistory(
        shipment.id,
        oldShipmentStatus,
        'cancelled',
        'system',
        'Shipment returned to origin and delivered back to warehouse.',
        transaction,
      );
    }
  }
}

/**
 * Helper to resolve any open NDR event for a shipment.
 */
async function resolveOpenNdr(shipmentId, status, transaction) {
  const ndr = await NdrEvent.findOne({
    where: { shipment_id: shipmentId, status: 'open' },
    transaction,
  });

  if (ndr) {
    await ndr.update({ status }, { transaction });
    logger.info(`[NdrDetection] Resolved open NDR for shipment ${shipmentId} as ${status}`);
  }
}

// Notification Hooks (Consolidated event emitters for Module 14)
async function onNdrCreated(shipmentId, reasonCode) {
  try {
    const { Shipment } = require('../models');
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return;

    const eventBus = require('../events/eventBus');
    eventBus.emit('ndr.created', {
      tenant_id: shipment.tenant_id,
      awb_number: shipment.awb_number,
      reason_code: reasonCode,
      courier_reason: reasonCode,
    });
  } catch (err) {
    logger.error(`[NdrDetection] Failed to trigger ndr.created event: ${err.message}`);
  }
}

async function onNdrActionTaken(shipmentId, actionType) {
  try {
    const { Shipment } = require('../models');
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return;

    const eventBus = require('../events/eventBus');
    eventBus.emit('ndr.action_taken', {
      tenant_id: shipment.tenant_id,
      awb_number: shipment.awb_number,
      action_type: actionType,
      notes: `Action: ${actionType}`,
    });
  } catch (err) {
    logger.error(`[NdrDetection] Failed to trigger ndr.action_taken event: ${err.message}`);
  }
}

async function onRtoInitiated(shipmentId, initiatedBy) {
  try {
    const { Shipment } = require('../models');
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return;

    const eventBus = require('../events/eventBus');
    eventBus.emit('rto.initiated', {
      tenant_id: shipment.tenant_id,
      awb_number: shipment.awb_number,
      reason: `RTO initiated by ${initiatedBy}`,
    });
  } catch (err) {
    logger.error(`[NdrDetection] Failed to trigger rto.initiated event: ${err.message}`);
  }
}

module.exports = {
  detectAndProcessNdrOrRto,
  onNdrCreated,
  onNdrActionTaken,
  onRtoInitiated,
};
