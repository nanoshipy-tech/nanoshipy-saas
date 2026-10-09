'use strict';

const auditLogRepository = require('../repositories/auditLog.repository');
const { SettingsExportFailedError } = require('../utils/errors');
const logger = require('../utils/logger');

const MAX_EXPORT_ROWS = parseInt(process.env.ACTIVITY_LOG_EXPORT_MAX_ROWS, 10) || 50000;

// ─────────────────────────────────────────────
// Tenant Activity Log
// ─────────────────────────────────────────────

/**
 * Search the tenant's own audit_logs with filtering + pagination.
 */
async function searchTenantActivityLog(tenantId, filters = {}, pagination = {}) {
  const { action, entityType, userId, dateFrom, dateTo } = filters;
  const { page = 1, limit = 50 } = pagination;

  return auditLogRepository.searchTenantAuditLog({
    tenantId,
    action,
    entityType,
    userId,
    dateFrom,
    dateTo,
    page,
    limit: Math.min(parseInt(limit, 10), 100), // cap page size at 100
  });
}

/**
 * Export tenant audit log as CSV string.
 * Capped at ACTIVITY_LOG_EXPORT_MAX_ROWS (default 50,000).
 * Returns { csv: string, rowCount: number }
 */
async function exportTenantActivityLog(tenantId, filters = {}) {
  try {
    const rows = await auditLogRepository.getTenantAuditLogForExport({
      tenantId,
      action: filters.action,
      entityType: filters.entityType,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      maxRows: MAX_EXPORT_ROWS,
    });

    const csv = _buildCsv(
      ['id', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'metadata', 'created_at'],
      rows.map(r => ({
        id: r.id,
        action: r.action,
        entity_type: r.entity_type || '',
        entity_id: r.entity_id || '',
        user_id: r.user_id || '',
        ip_address: r.ip_address || '',
        metadata: r.metadata ? JSON.stringify(r.metadata) : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
      }))
    );

    return { csv, rowCount: rows.length };
  } catch (err) {
    logger.error('[ActivityLogService] Failed to export tenant activity log', { error: err.message, tenantId });
    throw new SettingsExportFailedError('Failed to generate activity log export');
  }
}

// ─────────────────────────────────────────────
// Platform Activity Log
// ─────────────────────────────────────────────

/**
 * Search platform_audit_logs with filtering + pagination.
 */
async function searchPlatformActivityLog(filters = {}, pagination = {}) {
  const { action, targetTenantId, entityType, adminId, dateFrom, dateTo } = filters;
  const { page = 1, limit = 50 } = pagination;

  return auditLogRepository.searchPlatformAuditLog({
    action,
    targetTenantId,
    entityType,
    adminId,
    dateFrom,
    dateTo,
    page,
    limit: Math.min(parseInt(limit, 10), 100),
  });
}

/**
 * Export platform audit log as CSV.
 */
async function exportPlatformActivityLog(filters = {}) {
  try {
    const rows = await auditLogRepository.getPlatformAuditLogForExport({
      action: filters.action,
      targetTenantId: filters.targetTenantId,
      entityType: filters.entityType,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      maxRows: MAX_EXPORT_ROWS,
    });

    const csv = _buildCsv(
      ['id', 'action', 'entity_type', 'entity_id', 'target_tenant_id', 'platform_admin_id', 'ip_address', 'metadata', 'created_at'],
      rows.map(r => ({
        id: r.id,
        action: r.action,
        entity_type: r.entity_type || '',
        entity_id: r.entity_id || '',
        target_tenant_id: r.target_tenant_id || '',
        platform_admin_id: r.platform_admin_id || '',
        ip_address: r.ip_address || '',
        metadata: r.metadata ? JSON.stringify(r.metadata) : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
      }))
    );

    return { csv, rowCount: rows.length };
  } catch (err) {
    logger.error('[ActivityLogService] Failed to export platform activity log', { error: err.message });
    throw new SettingsExportFailedError('Failed to generate platform activity log export');
  }
}

// ─────────────────────────────────────────────
// CSV Builder
// ─────────────────────────────────────────────

/**
 * Build a CSV string from column headers and row objects.
 * Handles commas, quotes, and newlines in values.
 */
function _buildCsv(headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '');
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escape(row[h])).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

module.exports = {
  searchTenantActivityLog,
  exportTenantActivityLog,
  searchPlatformActivityLog,
  exportPlatformActivityLog,
};
