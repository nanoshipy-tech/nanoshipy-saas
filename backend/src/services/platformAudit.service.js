const { PlatformAuditLog } = require('../models');
const logger = require('../utils/logger');

const log = async ({ platform_admin_id, action, target_tenant_id, entity_type, entity_id, metadata, ip_address }) => {
  try {
    await PlatformAuditLog.create({
      platform_admin_id,
      action,
      target_tenant_id,
      entity_type,
      entity_id,
      metadata,
      ip_address,
    });
  } catch (error) {
    logger.error('Failed to write platform audit log:', { error: error.message });
  }
};

module.exports = {
  log,
};
