'use strict';

const { NdrEvent, NdrAction, RtoRecord, Shipment, CourierProvider, sequelize } = require('../models');
const ndrEventRepository = require('../repositories/ndrEvent.repository');
const rtoRecordRepository = require('../repositories/rtoRecord.repository');
const shipmentStatusService = require('./shipmentStatus.service');
const auditService = require('./audit.service');
const { RTO_STATUSES } = require('../constants/ndrReasonCodes.constant');
const ProviderFactory = require('../providers/ProviderFactory');
const providerCredentialService = require('./providerCredential.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class NdrAlreadyResolvedError extends Error {
  constructor(message = 'NDR event is already resolved') {
    super(message);
    this.name = 'NdrAlreadyResolvedError';
    this.status = 409;
    this.code = 'NDR_ALREADY_RESOLVED';
  }
}

class InvalidNdrActionError extends Error {
  constructor(message = 'Invalid NDR action') {
    super(message);
    this.name = 'InvalidNdrActionError';
    this.status = 422;
    this.code = 'INVALID_NDR_ACTION';
  }
}

/**
 * Executes a manual action on an NDR event.
 */
async function takeNdrAction(ndrEventId, tenantId, userId, actionData, transaction = null, options = {}) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());

  try {
    const whereClause = { id: ndrEventId };
    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    const ndr = await NdrEvent.findOne({
      where: whereClause,
      include: [
        {
          model: Shipment,
          as: 'shipment',
          include: [
            {
              model: CourierProvider,
              as: 'provider',
              scope: false,
              attributes: ['id', 'provider_key', 'credentials_encrypted', 'config', 'sandbox_mode'],
            },
          ],
        },
      ],
      transaction: txn,
    });

    if (!ndr) {
      throw new NotFoundError('NDR event not found');
    }

    const effectiveTenantId = tenantId || ndr.tenant_id;

    if (['resolved_delivered', 'resolved_rto'].includes(ndr.status)) {
      throw new NdrAlreadyResolvedError(`NDR event is in terminal state (${ndr.status}) and cannot accept further actions`);
    }

    let { action_type, notes, updated_address_line1, updated_phone } = actionData;
    if (action_type === 'rto') action_type = 'mark_rto';
    if (action_type === 'escalate') action_type = 'escalate_courier';

    const validActions = [
      'reattempt',
      'update_address',
      'update_phone',
      'mark_rto',
      'call_customer',
      'no_action',
      'escalate_courier',
    ];
    if (!validActions.includes(action_type)) {
      throw new InvalidNdrActionError(`Invalid action_type: ${action_type}`);
    }

    // Validate inputs
    if (action_type === 'update_address' && !updated_address_line1) {
      throw new InvalidNdrActionError('Address line 1 is required for update_address action');
    }
    if (action_type === 'update_phone' && !updated_phone) {
      throw new InvalidNdrActionError('Phone number is required for update_phone action');
    }

    // Call courier reattempt adapter method if supported
    if (['reattempt', 'update_address', 'update_phone'].includes(action_type)) {
      await callCourierReattempt(ndr.shipment, {
        action_type,
        updated_address_line1,
        updated_phone,
        notes,
      });

      // Synchronize updated contact/address details on parent order record
      if (ndr.shipment?.order_id) {
        const { Order } = require('../models');
        const orderUpdates = {};
        if (updated_address_line1) orderUpdates.shipping_address_line1 = updated_address_line1;
        if (updated_phone) orderUpdates.customer_phone = updated_phone;
        if (Object.keys(orderUpdates).length > 0) {
          await Order.update(orderUpdates, {
            where: { id: ndr.shipment.order_id },
            transaction: txn,
          });
        }
      }
    }

    let nextStatus = 'action_taken';
    let rtoRecordId = null;

    // Performer resolution: if userId is not in users table (e.g. platform admin),
    // attempt to find user, or fallback to first tenant user, or null if nullable
    const models = require('../models');
    const User = models.User;
    let validPerformerId = null;
    if (userId) {
      if (User && typeof User.findByPk === 'function') {
        const user = await User.findByPk(userId, { attributes: ['id'], transaction: txn });
        if (user) {
          validPerformerId = user.id;
        } else if (effectiveTenantId && typeof User.findOne === 'function') {
          const tenantUser = await User.findOne({
            where: { tenant_id: effectiveTenantId },
            attributes: ['id'],
            transaction: txn,
          });
          if (tenantUser) validPerformerId = tenantUser.id;
        }
      } else {
        validPerformerId = userId;
      }
    }

    if (action_type === 'mark_rto') {
      nextStatus = 'resolved_rto';

      // Create RTO record
      const rto = await RtoRecord.create(
        {
          tenant_id: effectiveTenantId,
          shipment_id: ndr.shipment_id,
          initiated_reason: notes || 'Manually marked for RTO',
          initiated_by: 'manual',
          status: RTO_STATUSES.RTO_INITIATED,
        },
        { transaction: txn },
      );
      rtoRecordId = rto.id;

      // Update shipment status to cancelled (which acts as shipment cancel-to-RTO)
      const oldShipmentStatus = ndr.shipment.status;
      if (oldShipmentStatus !== 'cancelled') {
        await ndr.shipment.update({ status: 'cancelled' }, { transaction: txn });
        await shipmentStatusService.logHistory(
          ndr.shipment_id,
          oldShipmentStatus,
          'cancelled',
          'manual',
          notes || 'Manually returned to origin.',
          txn,
        );
      }

      await auditService.log({
        action: 'rto_initiated',
        tenant_id: effectiveTenantId,
        user_id: validPerformerId,
        entity_type: 'shipment',
        entity_id: ndr.shipment_id,
        metadata: { reason: 'manual_ndr_action' },
        transaction: txn,
      });
    }

    // Record Action
    const action = await NdrAction.create(
      {
        ndr_event_id: ndrEventId,
        action_type,
        notes,
        updated_address_line1: action_type === 'update_address' ? updated_address_line1 : null,
        updated_phone: action_type === 'update_phone' ? updated_phone : null,
        performed_by: validPerformerId,
      },
      { transaction: txn },
    );

    // Update NDR status
    await ndr.update({ status: nextStatus }, { transaction: txn });

    await auditService.log({
      action: 'ndr_action_taken',
      tenant_id: effectiveTenantId,
      user_id: validPerformerId,
      entity_type: 'ndr_event',
      entity_id: ndrEventId,
      metadata: { action_type, notes },
      transaction: txn,
    });

    // Platform admin audit log
    if (options.isPlatformAdmin || options.adminId) {
      const { logAdminAction } = require('../utils/adminAudit.helper');
      await logAdminAction({
        adminId: options.adminId || userId,
        action: `ndr_action_${action_type}`,
        targetTenantId: effectiveTenantId,
        entityType: 'ndr_event',
        entityId: ndrEventId,
        metadata: { action_type, notes, shipment_id: ndr.shipment_id },
        ipAddress: options.ipAddress,
        transaction: txn,
      });
    }

    if (ownTxn) await txn.commit();

    // Call notification hooks (Module 14 Hook)
    try {
      const ndrDetectionService = require('./ndrDetection.service');
      ndrDetectionService.onNdrActionTaken(ndr.shipment_id, action_type).catch(() => {});
      if (action_type === 'mark_rto') {
        ndrDetectionService.onRtoInitiated(ndr.shipment_id, 'manual').catch(() => {});
      }
    } catch (hookErr) {
      logger.error(`[NdrService] Notification hooks failed: ${hookErr.message}`);
    }

    return {
      ndr_id: ndrEventId,
      status: nextStatus,
      action_type,
      rto_record_id: rtoRecordId,
    };
  } catch (err) {
    if (ownTxn) await txn.rollback();
    throw err;
  }
}

/**
 * Courier integration helper for triggering reattempts.
 */
async function callCourierReattempt(shipment, params) {
  const provider = shipment.provider;
  if (!provider) return;

  try {
    const credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
    const configData = { ...provider.config, sandbox_mode: provider.sandbox_mode };

    const adapter = await ProviderFactory.getAdapter(
      provider.provider_key,
      credentials,
      configData,
      provider.id,
    );

    if (typeof adapter.requestReattempt === 'function') {
      logger.info(`[NdrService] Calling reattempt api for AWB ${shipment.awb_number}`);
      await adapter.requestReattempt({
        awbNumber: shipment.awb_number,
        ...params,
      });
    }
  } catch (err) {
    // Reattempts are non-critical if they fail. Log and skip to ensure DB writes succeed.
    logger.warn(`[NdrService] Courier reattempt call failed: ${err.message}`);
  }
}

/**
 * Bulk action center logic. Re-validates tenant scope for every ID.
 */
async function takeBulkNdrAction(tenantId, userId, bulkData, options = {}) {
  const { ndr_ids, action_type, notes, updated_address_line1, updated_phone } = bulkData;

  if (!Array.isArray(ndr_ids) || ndr_ids.length === 0) {
    throw new BadRequestError('ndr_ids array is required');
  }

  if (ndr_ids.length > 100) {
    throw new BadRequestError('Bulk action limited to maximum of 100 NDR IDs per batch');
  }

  let processed = 0;
  let failed = 0;
  const details = [];

  for (const ndrId of ndr_ids) {
    try {
      await takeNdrAction(ndrId, tenantId, userId, {
        action_type,
        notes,
        updated_address_line1,
        updated_phone,
      }, null, options);
      processed++;
      details.push({ id: ndrId, success: true });
    } catch (err) {
      failed++;
      details.push({ id: ndrId, success: false, reason: err.message });
      logger.warn(`[NdrService] Bulk action failed for NDR ${ndrId}: ${err.message}`);
    }
  }

  await auditService.log({
    action: 'ndr_bulk_action',
    tenant_id: tenantId,
    user_id: userId,
    metadata: { processed, failed, action_type },
  });

  return {
    processed,
    failed,
    details,
  };
}

/**
 * Generates an aggregated breakdown of NDR events for widgets.
 */
async function getNdrSummary(tenantId) {
  const where = {
    status: { [Op.in]: ['open', 'action_taken'] },
  };
  if (tenantId) where.tenant_id = tenantId;

  // Count total open/action taken NDRs
  const totalOpen = await NdrEvent.count({ where });

  // Breakdown by reason code
  const reasonCounts = await NdrEvent.findAll({
    where,
    attributes: [
      'reason_code',
      [sequelize.fn('COUNT', sequelize.col('reason_code')), 'count'],
    ],
    group: ['reason_code'],
  });

  const byReason = {
    CUSTOMER_UNAVAILABLE: 0,
    ADDRESS_INCORRECT: 0,
    CUSTOMER_REFUSED: 0,
    COD_NOT_READY: 0,
    OTHER: 0,
  };

  reasonCounts.forEach(r => {
    const code = r.getDataValue('reason_code');
    const count = parseInt(r.getDataValue('count'), 10);
    if (byReason[code] !== undefined) {
      byReason[code] = count;
    } else {
      byReason.OTHER += count;
    }
  });

  // SLA Aging checks
  const agingOverSla = await NdrEvent.count({
    where: {
      tenant_id: tenantId,
      status: { [Op.in]: ['open', 'action_taken'] },
      sla_due_at: { [Op.lt]: new Date() },
    },
  });

  return {
    total_open: totalOpen,
    by_reason: byReason,
    aging_over_sla: agingOverSla,
  };
}

/**
 * Scheduled check for NDR SLA breaches.
 * Auto-executes tenant fallback action (re-attempt or RTO) for cases exceeding 24h SLA.
 */
async function checkNdrSlaBreaches() {
  const breachedEvents = await NdrEvent.findAll({
    where: {
      status: 'open',
      sla_due_at: { [Op.lt]: new Date() },
    },
    include: [{ model: Shipment, as: 'shipment' }],
  });

  if (breachedEvents.length === 0) return 0;

  logger.warn(`[NdrSlaBreach] Detected ${breachedEvents.length} open NDR events breaching 24h SLA. Executing auto-fallback...`);
  let resolvedCount = 0;

  for (const ndr of breachedEvents) {
    try {
      // Default: auto-request 1 final delivery reattempt, or mark RTO if already attempted
      const actionType = ndr.reattempt_count >= 2 ? 'mark_rto' : 'reattempt';
      await takeNdrAction(ndr.id, ndr.tenant_id, null, {
        action_type: actionType,
        notes: `System SLA auto-action triggered after 24h window elapsed. Action: ${actionType}`,
      });
      resolvedCount++;
    } catch (err) {
      logger.error(`[NdrSlaBreach] Failed auto-action for NDR ${ndr.id}: ${err.message}`);
    }
  }

  logger.info(`[NdrSlaBreach] Successfully auto-resolved ${resolvedCount}/${breachedEvents.length} SLA-breached NDRs`);
  return resolvedCount;
}

module.exports = {
  takeNdrAction,
  takeBulkNdrAction,
  getNdrSummary,
  checkNdrSlaBreaches,
  NdrAlreadyResolvedError,
  InvalidNdrActionError,
};
