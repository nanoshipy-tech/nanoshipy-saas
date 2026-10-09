'use strict';

const { PlatformAuditLog } = require('../models');
const logger = require('./logger');

/**
 * Log an administrative action to platform_audit_logs.
 * @param {Object} options
 * @param {string} options.adminId - ID of platform admin performing the action
 * @param {string} options.action - Action identifier string (e.g. 'wallet_debit_adjustment', 'ndr_action_taken')
 * @param {string} [options.targetTenantId] - Target tenant ID if applicable
 * @param {string} [options.entityType] - Entity type (e.g. 'tenant', 'shipment', 'wallet_adjustment')
 * @param {string} [options.entityId] - Entity ID
 * @param {Object} [options.metadata] - Additional contextual key-values
 * @param {string} [options.ipAddress] - Request IP address
 * @param {Object} [options.transaction] - Sequelize transaction if part of an existing transaction
 */
async function logAdminAction({
  adminId,
  action,
  targetTenantId = null,
  entityType = null,
  entityId = null,
  metadata = {},
  ipAddress = null,
  transaction = null,
}) {
  try {
    if (!adminId) {
      logger.warn(`[AdminAudit] Attempted to log admin action '${action}' without adminId.`);
    }

    const logEntry = await PlatformAuditLog.create({
      platform_admin_id: adminId || '00000000-0000-0000-0000-000000000000',
      action,
      target_tenant_id: targetTenantId,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      metadata,
      ip_address: ipAddress,
    }, transaction ? { transaction } : {});

    return logEntry;
  } catch (err) {
    logger.error(`[AdminAudit] Failed to record platform audit log: ${err.message}`, {
      action,
      adminId,
      error: err,
    });
    // Never throw to prevent audit failures from aborting customer/admin workflows
    return null;
  }
}

module.exports = {
  logAdminAction,
};
