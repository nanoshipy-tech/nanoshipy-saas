'use strict';

const { RtoRecord, NdrEvent, Shipment, sequelize } = require('../models');
const rtoRecordRepository = require('../repositories/rtoRecord.repository');
const shipmentStatusService = require('./shipmentStatus.service');
const auditService = require('./audit.service');
const { RTO_STATUSES } = require('../constants/ndrReasonCodes.constant');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Update the status of an RTO record (e.g. mark as delivered to origin warehouse).
 */
async function updateRtoStatus(rtoId, tenantId, userId, updateData) {
  const { status, notes, rto_awb_number } = updateData;

  if (!Object.values(RTO_STATUSES).includes(status)) {
    throw new BadRequestError(`Invalid RTO status: ${status}`);
  }

  const txn = await sequelize.transaction();

  try {
    const rto = await RtoRecord.findOne({
      where: { id: rtoId, tenant_id: tenantId },
      include: [{ model: Shipment, as: 'shipment' }],
      transaction: txn,
    });

    if (!rto) {
      throw new NotFoundError('RTO record not found');
    }

    const oldStatus = rto.status;
    const saveParams = { status };

    if (notes) {
      rto.initiated_reason = `${rto.initiated_reason} | Update note: ${notes}`;
    }

    if (rto_awb_number) {
      saveParams.rto_awb_number = rto_awb_number;
    }

    if (status === RTO_STATUSES.RTO_DELIVERED) {
      saveParams.received_at_warehouse_at = new Date();
    }

    await rto.update(saveParams, { transaction: txn });

    // Update parent shipment history / status if delivered
    if (status === RTO_STATUSES.RTO_DELIVERED) {
      // Resolve open NDRs as resolved_rto
      await NdrEvent.update(
        { status: 'resolved_rto' },
        {
          where: { shipment_id: rto.shipment_id, status: 'open' },
          transaction: txn,
        },
      );

      // Update parent shipment status to rto_delivered
      const oldShipmentStatus = rto.shipment.status;
      if (oldShipmentStatus !== 'rto_delivered') {
        await rto.shipment.update({ status: 'rto_delivered' }, { transaction: txn });
      }
      await shipmentStatusService.logHistory(
        rto.shipment_id,
        oldShipmentStatus,
        'rto_delivered',
        'manual',
        notes || 'Returned parcel successfully received back at origin warehouse.',
        txn,
      );
    }

    await auditService.log({
      action: 'rto_status_updated',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'rto_record',
      entity_id: rtoId,
      metadata: { old_status: oldStatus, new_status: status, notes },
    });

    await txn.commit();
    return rto;
  } catch (err) {
    await txn.rollback();
    logger.error(`[RtoService] Failed to update RTO status: ${err.message}`);
    throw err;
  }
}

module.exports = {
  updateRtoStatus,
};
