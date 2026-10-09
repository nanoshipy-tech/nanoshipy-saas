'use strict';

const { TenantSetting, PlatformSetting, SettingsChangeHistory } = require('../models');

// ─────────────────────────────────────────────
// Tenant Settings
// ─────────────────────────────────────────────

/**
 * Find or return null for a tenant's settings row.
 */
const findTenantSettings = async (tenantId) => {
  return TenantSetting.findOne({ where: { tenant_id: tenantId } });
};

/**
 * Upsert tenant settings row (create if not exists, update if exists).
 */
const upsertTenantSettings = async (tenantId, updates, userId, transaction = null) => {
  const [row, created] = await TenantSetting.findOrCreate({
    where: { tenant_id: tenantId },
    defaults: { ...updates, tenant_id: tenantId, updated_by: userId },
    transaction,
  });

  if (!created) {
    await row.update({ ...updates, updated_by: userId }, { transaction });
  }

  return row.reload({ transaction });
};

// ─────────────────────────────────────────────
// Platform Settings
// ─────────────────────────────────────────────

/**
 * Get all platform settings.
 */
const findAllPlatformSettings = async () => {
  return PlatformSetting.findAll({ order: [['setting_key', 'ASC']] });
};

/**
 * Get a single platform setting by key.
 */
const findPlatformSettingByKey = async (key) => {
  return PlatformSetting.findOne({ where: { setting_key: key } });
};

/**
 * Update a platform setting value. Returns the updated row.
 */
const updatePlatformSetting = async (key, newValue, adminId, transaction = null) => {
  const row = await PlatformSetting.findOne({ where: { setting_key: key }, transaction });
  if (!row) return null;
  await row.update({ setting_value: String(newValue), updated_by: adminId }, { transaction });
  return row;
};

// ─────────────────────────────────────────────
// Change History
// ─────────────────────────────────────────────

/**
 * Record a settings change in the audit history.
 */
const recordChangeHistory = async ({ scope, scopeId, settingKey, oldValue, newValue, changedBy }, transaction = null) => {
  return SettingsChangeHistory.create({
    scope,
    scope_id: scopeId || null,
    setting_key: settingKey,
    old_value: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
    new_value: String(newValue),
    changed_by: changedBy || null,
  }, { transaction });
};

module.exports = {
  findTenantSettings,
  upsertTenantSettings,
  findAllPlatformSettings,
  findPlatformSettingByKey,
  updatePlatformSetting,
  recordChangeHistory,
};
