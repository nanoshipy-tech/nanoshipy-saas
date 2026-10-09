const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Log an action to the audit_logs table.
 * 
 * @param {Object} params
 * @param {string} params.action - e.g. 'login', 'register', 'password_reset'
 * @param {string} [params.tenant_id] - Optional UUID
 * @param {string} [params.user_id] - Optional UUID
 * @param {string} [params.entity_type] - e.g. 'user', 'tenant'
 * @param {string} [params.entity_id] - Optional UUID of the affected entity
 * @param {Object} [params.metadata] - JSON payload with extra context
 * @param {Object} [params.req] - Express request object (to extract IP)
 */
const log = async ({ action, tenant_id = null, user_id = null, entity_type = null, entity_id = null, metadata = null, req = null, transaction = null }) => {
  try {
    let ip_address = null;
    if (req) {
      ip_address = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    }

    await AuditLog.create({
      tenant_id,
      user_id,
      action,
      entity_type,
      entity_id,
      metadata,
      ip_address,
    }, transaction ? { transaction } : {});
  } catch (error) {
    // We swallow the error here because audit logging failure shouldn't break the main flow.
    // But we must log it to the system logger.
    logger.error('[AuditService] Failed to create audit log', {
      error: error.message,
      action,
      tenant_id,
      user_id,
    });
  }
};

module.exports = {
  log,
};
