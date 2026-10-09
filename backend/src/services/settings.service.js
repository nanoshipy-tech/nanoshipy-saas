'use strict';

/**
 * settings.service.js — Unified three-tier settings resolution.
 *
 * Resolution order for any setting key:
 *   1. tenant_settings row (tenant override)  — highest priority
 *   2. platform_settings row (DB default)
 *   3. config/env.js fallback                 — lowest priority / last resort
 *
 * Callers should always use getEffectiveSetting() rather than reading
 * process.env directly for values that are now DB-configurable.
 */

const config = require('../config/env');
const settingsRepository = require('../repositories/settings.repository');
const { SettingNotFoundError, InvalidSettingValueError } = require('../utils/errors');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
// ENV Fallback Map
// Maps setting keys → env/config fallback values (tier 3)
// ─────────────────────────────────────────────
const ENV_FALLBACKS = {
  default_gst_rate_percent:        () => config.billing.gstRatePercent || 18,
  ndr_auto_rto_threshold:          () => config.ndr.autoRtoThreshold || 3,
  low_balance_threshold:           () => 500,
  audit_log_retention_days:        () => parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 365,
  webhook_max_retry_attempts:      () => parseInt(process.env.WEBHOOK_MAX_RETRY_ATTEMPTS, 10) || 5,
  // Invoice prefix — tenant-level only; env fallback is 'INV'
  invoice_prefix:                  () => 'INV',
};

// Tenant-overridable setting keys and their mapping to tenant_settings columns
const TENANT_OVERRIDE_COLUMNS = {
  invoice_prefix:                 'invoice_prefix_override',
  ndr_auto_rto_threshold:         'ndr_auto_rto_threshold_override',
  default_pickup_address_id:      'default_pickup_address_id',
  low_balance_threshold:          'low_balance_threshold_override',
};

// Platform setting key mapping (tenant keys may differ from platform keys)
const PLATFORM_KEY_MAP = {
  ndr_auto_rto_threshold: 'default_ndr_auto_rto_threshold',
  low_balance_threshold:  'default_low_balance_threshold',
  invoice_prefix:         null, // invoice_prefix is tenant-only; no platform default (falls back to env)
};

// Cache for platform settings to avoid N+1 DB hits on hot paths.
// Invalidated on every platform setting write.
let _platformSettingsCache = null;
let _cachePopulatedAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function _getPlatformSettingsMap() {
  const now = Date.now();
  if (_platformSettingsCache && _cachePopulatedAt && (now - _cachePopulatedAt) < CACHE_TTL_MS) {
    return _platformSettingsCache;
  }
  const rows = await settingsRepository.findAllPlatformSettings();
  _platformSettingsCache = {};
  for (const row of rows) {
    _platformSettingsCache[row.setting_key] = _coerceValue(row.setting_value, row.value_type);
  }
  _cachePopulatedAt = now;
  return _platformSettingsCache;
}

function _invalidatePlatformCache() {
  _platformSettingsCache = null;
  _cachePopulatedAt = null;
}

function _coerceValue(value, valueType) {
  switch (valueType) {
    case 'number':  return parseFloat(value);
    case 'boolean': return value === 'true' || value === true;
    case 'json':    try { return JSON.parse(value); } catch { return value; }
    default:        return value;
  }
}

// ─────────────────────────────────────────────
// Core resolution function
// ─────────────────────────────────────────────

/**
 * Get the effective value for a setting key.
 * @param {string|null} tenantId  — pass null for platform-only settings (e.g. GST rate)
 * @param {string} key            — the logical setting key
 * @returns {Promise<{ value: any, source: 'tenant_override'|'platform_default'|'env_fallback' }>}
 */
async function getEffectiveSetting(tenantId, key) {
  // Tier 1: tenant override
  if (tenantId && TENANT_OVERRIDE_COLUMNS[key]) {
    const tenantSettings = await settingsRepository.findTenantSettings(tenantId);
    const column = TENANT_OVERRIDE_COLUMNS[key];
    if (tenantSettings && tenantSettings[column] !== null && tenantSettings[column] !== undefined) {
      return { value: tenantSettings[column], source: 'tenant_override' };
    }
  }

  // Tier 2: platform DB default
  const platformKey = (PLATFORM_KEY_MAP[key] !== undefined) ? PLATFORM_KEY_MAP[key] : key;
  if (platformKey) {
    try {
      const platformMap = await _getPlatformSettingsMap();
      if (platformKey in platformMap) {
        return { value: platformMap[platformKey], source: 'platform_default' };
      }
    } catch (err) {
      logger.warn(`[SettingsService] Could not load platform settings for key "${key}": ${err.message}. Falling back to env.`);
    }
  }

  // Tier 3: env fallback
  if (ENV_FALLBACKS[key]) {
    return { value: ENV_FALLBACKS[key](), source: 'env_fallback' };
  }

  // If we get here the key is truly unknown
  logger.warn(`[SettingsService] Unknown setting key requested: "${key}"`);
  return { value: null, source: 'env_fallback' };
}

// ─────────────────────────────────────────────
// Tenant Settings API
// ─────────────────────────────────────────────

/**
 * Get all tenant settings with resolved effective values and metadata.
 * Returns a response map shaped as { key: { value, is_override, source } }
 */
async function getTenantSettings(tenantId) {
  const tenantRow = await settingsRepository.findTenantSettings(tenantId);
  const platformMap = await _getPlatformSettingsMap().catch(() => ({}));

  const buildField = async (key) => {
    const result = await getEffectiveSetting(tenantId, key);
    return {
      value: result.value,
      is_override: result.source === 'tenant_override',
      source: result.source,
    };
  };

  return {
    invoice_prefix:            await buildField('invoice_prefix'),
    ndr_auto_rto_threshold:    await buildField('ndr_auto_rto_threshold'),
    low_balance_threshold:     await buildField('low_balance_threshold'),
    default_pickup_address_id: await buildField('default_pickup_address_id'),
  };
}

/**
 * Update tenant settings — writes to tenant_settings row and records change history.
 */
async function updateTenantSettings(tenantId, userId, updates) {
  const { sequelize } = require('../models');
  const txn = await sequelize.transaction();

  try {
    // Get existing values before overwrite for change history
    const existing = await settingsRepository.findTenantSettings(tenantId);

    // Map logical keys to column names
    const columnUpdates = {};
    const COLUMN_MAP = {
      invoice_prefix:            'invoice_prefix_override',
      ndr_auto_rto_threshold:    'ndr_auto_rto_threshold_override',
      default_pickup_address_id: 'default_pickup_address_id',
      low_balance_threshold:     'low_balance_threshold_override',
    };

    for (const [key, val] of Object.entries(updates)) {
      const col = COLUMN_MAP[key];
      if (!col) continue;

      const oldValue = existing ? existing[col] : null;
      columnUpdates[col] = val === '' || val === null ? null : val;

      await settingsRepository.recordChangeHistory({
        scope: 'tenant',
        scopeId: tenantId,
        settingKey: key,
        oldValue,
        newValue: val,
        changedBy: userId,
      }, txn);
    }

    const updatedRow = await settingsRepository.upsertTenantSettings(tenantId, columnUpdates, userId, txn);
    await txn.commit();
    return updatedRow;
  } catch (err) {
    await txn.rollback();
    throw err;
  }
}

// ─────────────────────────────────────────────
// Platform Settings API
// ─────────────────────────────────────────────

/**
 * Get all platform settings rows.
 */
async function getPlatformSettings() {
  return settingsRepository.findAllPlatformSettings();
}

/**
 * Update a single platform setting value.
 * Validates against value_type and records change history.
 */
async function updatePlatformSetting(key, newValue, adminId) {
  const { sequelize } = require('../models');
  const txn = await sequelize.transaction();

  try {
    let existing = await settingsRepository.findPlatformSettingByKey(key);
    if (!existing) {
      const { PlatformSetting } = require('../models');
      const valStr = String(newValue);
      let detectedType = 'string';
      if (valStr === 'true' || valStr === 'false') detectedType = 'boolean';
      else if (!isNaN(Number(valStr)) && valStr.trim() !== '') detectedType = 'number';

      existing = await PlatformSetting.create({
        setting_key: key,
        setting_value: valStr,
        value_type: detectedType,
        description: `Platform setting for ${key}`,
        updated_by: adminId,
      }, { transaction: txn });

      await settingsRepository.recordChangeHistory({
        scope: 'platform',
        scopeId: null,
        settingKey: key,
        oldValue: null,
        newValue: valStr,
        changedBy: adminId,
      }, txn);

      await txn.commit();
      _invalidatePlatformCache();
      return existing;
    }

    // Validate value against declared type
    const { value_type } = existing;
    if (value_type === 'number' && isNaN(parseFloat(newValue))) {
      throw new InvalidSettingValueError(`Setting "${key}" expects a numeric value`);
    }
    if (value_type === 'boolean' && !['true', 'false', true, false].includes(newValue)) {
      throw new InvalidSettingValueError(`Setting "${key}" expects true or false`);
    }
    if (value_type === 'json') {
      try { JSON.parse(newValue); } catch {
        throw new InvalidSettingValueError(`Setting "${key}" expects valid JSON`);
      }
    }

    const oldValue = existing.setting_value;

    await settingsRepository.recordChangeHistory({
      scope: 'platform',
      scopeId: null,
      settingKey: key,
      oldValue,
      newValue: String(newValue),
      changedBy: adminId,
    }, txn);

    const updated = await settingsRepository.updatePlatformSetting(key, newValue, adminId, txn);
    await txn.commit();

    // Invalidate in-memory platform settings cache immediately
    _invalidatePlatformCache();

    return updated;
  } catch (err) {
    await txn.rollback();
    throw err;
  }
}

module.exports = {
  getEffectiveSetting,
  getTenantSettings,
  updateTenantSettings,
  getPlatformSettings,
  updatePlatformSetting,
  _invalidatePlatformCache,
};
