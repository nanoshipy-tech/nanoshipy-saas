'use strict';

const courierProviderService = require('../services/courierProvider.service');
const providerHealthService = require('../services/providerHealth.service');
const courierProviderRepository = require('../repositories/courierProvider.repository');
const providerCredentialService = require('../services/providerCredential.service');
const ProviderFactory = require('../providers/ProviderFactory');
const { ProviderHealthLog, TenantCourierAccess } = require('../models');
const { success, error } = require('../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const { is_active, provider_key, page, limit } = req.query;
    const result = await courierProviderRepository.findAll({
      is_active,
      provider_key,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    }, true);

    // Add credentials mask placeholder to match AC and Admin UI
    const rows = result.rows.map(item => {
      const data = item.toJSON();
      let creds = {};
      if (item.credentials_encrypted) {
        try {
          creds = providerCredentialService.decrypt(item.credentials_encrypted) || {};
        } catch (_) {
          creds = {};
        }
      }
      delete data.credentials_encrypted;
      data.credentials = '***MASKED***';
      data.username = creds.username || creds.client_name || creds.login_id || creds.customer_code || creds.email || '';
      const rawApiKey = creds.api_key || creds.api_token || creds.license_key || creds.jwt_token || '';
      data.api_key = rawApiKey ? '••••••••' + String(rawApiKey).slice(-4) : '';
      const rawSecret = creds.api_secret || creds.password || creds.token || '';
      data.api_secret = rawSecret ? '••••••••' : '';
      data.mode = item.config?.sandbox_mode ? 'sandbox' : 'live';
      return data;
    });

    return success(res, { ...result, rows });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const provider = await courierProviderRepository.findById(req.params.id, true);
    if (!provider) {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Courier provider not found' } });
    }

    const data = provider.toJSON();
    let creds = {};
    if (provider.credentials_encrypted) {
      try {
        creds = providerCredentialService.decrypt(provider.credentials_encrypted) || {};
      } catch (_) {
        creds = {};
      }
    }
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';
    data.username = creds.username || creds.client_name || creds.login_id || creds.customer_code || creds.email || '';
    const rawApiKey = creds.api_key || creds.api_token || creds.license_key || creds.jwt_token || '';
    data.api_key = rawApiKey ? '••••••••' + String(rawApiKey).slice(-4) : '';
    const rawSecret = creds.api_secret || creds.password || creds.token || '';
    data.api_secret = rawSecret ? '••••••••' : '';
    data.mode = provider.config?.sandbox_mode ? 'sandbox' : 'live';

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const onboard = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin.id;
    const provider = await courierProviderService.onboard(req.body, platformAdminId, req);
    
    const data = provider.toJSON();
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';

    return success(res, data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin.id;
    const provider = await courierProviderService.update(req.params.id, req.body, platformAdminId, req);

    const data = provider.toJSON();
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const toggle = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin.id;
    const { is_active } = req.body;
    const provider = await courierProviderService.toggle(req.params.id, is_active, platformAdminId, req);

    const data = provider.toJSON();
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const healthCheck = async (req, res, next) => {
  try {
    const result = await providerHealthService.runHealthCheck(req.params.id);
    return success(res, { healthy: result.healthy, latency_ms: result.latencyMs });
  } catch (err) {
    next(err);
  }
};

const healthLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await ProviderHealthLog.findAndCountAll({
      where: { courier_provider_id: req.params.id },
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['checked_at', 'DESC']],
    });

    return success(res, {
      rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const grantAccess = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin.id;
    const { tenant_id } = req.body;
    const access = await courierProviderService.grantTenantAccess(req.params.id, tenant_id, platformAdminId, req);
    return success(res, access, 201);
  } catch (err) {
    next(err);
  }
};

const revokeAccess = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin.id;
    const { tenantId } = req.params;
    const result = await courierProviderService.revokeTenantAccess(req.params.id, tenantId, platformAdminId, req);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const getCircuitBreakerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const provider = await courierProviderRepository.findById(id);
    if (!provider) {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Courier provider not found' } });
    }
    
    const circuitBreakerUtil = require('../providers/shared/circuitBreaker.util');
    const status = await circuitBreakerUtil.getBreakerStatus(id);

    return success(res, {
      provider_id: id,
      database_state: provider.circuit_breaker_state,
      redis_state: status.state,
      consecutive_failures: status.failures,
      opened_at: provider.circuit_breaker_opened_at,
    });
  } catch (err) {
    next(err);
  }
};

const resetCircuitBreaker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const provider = await courierProviderRepository.findById(id);
    if (!provider) {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Courier provider not found' } });
    }

    const circuitBreakerUtil = require('../providers/shared/circuitBreaker.util');
    await circuitBreakerUtil.resetBreaker(id);

    return success(res, {
      message: 'Circuit breaker reset successfully',
      provider_id: id,
      state: 'closed',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update courier provider by provider_key (code) instead of UUID.
 * Used by the admin couriers UI which knows only 'shipway', 'delhivery', etc.
 */
const updateByKey = async (req, res, next) => {
  try {
    const { providerKey } = req.params;
    const platformAdminId = req.platformAdmin.id;

    let found = await courierProviderRepository.findByKey(providerKey, true);

    const displayNames = {
      shipway: 'Shipway Aggregator',
      stcourier: 'ST Courier (Tamil Nadu Express)',
      delhivery: 'Delhivery Express Direct',
      bluedart: 'Bluedart DHL Logistics',
      xpressbees: 'Xpressbees Direct',
      ecomexpress: 'Ecom Express',
      shadowfax: 'Shadowfax Hyperlocal & Forward',
    };

    const { mode, api_key, api_secret, username, is_active, logo_url, display_name } = req.body;

    // Safely decrypt existing credentials — old ciphertext from a different
    // encryption key would throw; fall back to empty object so save can proceed.
    let existingCreds = {};
    if (found && found.credentials_encrypted) {
      try {
        existingCreds = providerCredentialService.decrypt(found.credentials_encrypted) || {};
      } catch (_decryptErr) {
        // Stale/invalid ciphertext — treat as no prior credentials
        existingCreds = {};
      }
    }

    const newCreds = { ...existingCreds };

    // Normalise UI field names into provider-specific field names so that
    // Joi credential schemas (which are provider-aware) and adapters work seamlessly.
    if (username !== undefined && !username.startsWith('••••')) {
      newCreds.username      = username;   // shipway, ecomexpress, generic
      newCreds.client_name   = username;   // delhivery
      newCreds.login_id      = username;   // bluedart
      newCreds.customer_code = username;   // bluedart
      newCreds.email         = username;   // xpressbees, shipway
      newCreds.client_code   = username;   // shadowfax
      newCreds.store_id      = username;   // shadowfax
    }

    if (api_key !== undefined && !api_key.startsWith('••••')) {
      newCreds.api_key     = api_key;   // generic
      newCreds.api_token   = api_key;   // delhivery
      newCreds.license_key = api_key;   // shipway, bluedart
      newCreds.licence_key = api_key;   // bluedart alias
      newCreds.jwt_token   = api_key;   // bluedart alias
      newCreds.token       = api_key;   // xpressbees, shadowfax
    }

    if (api_secret !== undefined && !api_secret.startsWith('••••')) {
      newCreds.api_secret = api_secret; // generic
      newCreds.password   = api_secret; // ecomexpress, bluedart, xpressbees
      if (!newCreds.token) {
        newCreds.token = api_secret; // shadowfax, xpressbees fallback
      }
      if (!newCreds.license_key) {
        newCreds.license_key = api_secret; // shipway, bluedart fallback
      }
      if (!newCreds.api_token) {
        newCreds.api_token = api_secret; // delhivery fallback
      }
    }

    // Provider-specific sanity fallbacks ensure all adapters find expected keys
    if (providerKey === 'ecomexpress' && !newCreds.password && newCreds.api_secret) {
      newCreds.password = newCreds.api_secret;
    }
    if (providerKey === 'shadowfax' && !newCreds.token && (newCreds.api_secret || newCreds.api_key)) {
      newCreds.token = newCreds.api_secret || newCreds.api_key;
    }
    if (providerKey === 'xpressbees' && !newCreds.token && (newCreds.api_key || newCreds.api_secret)) {
      newCreds.token = newCreds.api_key || newCreds.api_secret;
    }
    if (providerKey === 'bluedart') {
      if (!newCreds.login_id && newCreds.username) newCreds.login_id = newCreds.username;
      if (!newCreds.customer_code && newCreds.username) newCreds.customer_code = newCreds.username;
      if (!newCreds.license_key && newCreds.api_key) newCreds.license_key = newCreds.api_key;
    }

    if (!found) {
      const onboardPayload = {
        provider_key: providerKey,
        display_name: display_name || displayNames[providerKey] || providerKey.toUpperCase(),
        logo_url: logo_url || null,
        supports_cod: true,
        supports_prepaid: true,
        credentials: newCreds,
        config: { sandbox_mode: mode === 'sandbox' },
        is_active: is_active ?? true,
      };

      found = await courierProviderService.onboard(onboardPayload, platformAdminId, req);
      const data = found.toJSON();
      delete data.credentials_encrypted;
      data.credentials = '***MASKED***';
      data.username = newCreds.username || newCreds.client_name || newCreds.email || newCreds.customer_code || newCreds.login_id || '';
      const rawApiKey = newCreds.api_key || newCreds.license_key || newCreds.token || newCreds.api_token || '';
      data.api_key = rawApiKey ? '••••••••' + String(rawApiKey).slice(-4) : '';
      data.api_secret = (newCreds.api_secret || newCreds.password) ? '••••••••' : '';
      data.mode = mode || 'sandbox';
      return success(res, data);
    }

    const updatePayload = {};
    if (Object.keys(newCreds).length > 0) updatePayload.credentials = newCreds;
    if (mode !== undefined) updatePayload.config = { ...(found.config || {}), sandbox_mode: mode === 'sandbox' };
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (logo_url !== undefined) updatePayload.logo_url = logo_url;
    if (display_name !== undefined) updatePayload.display_name = display_name;

    const updated = await courierProviderService.update(found.id, updatePayload, platformAdminId, req);
    const data = updated.toJSON();
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';
    data.username = newCreds.username || newCreds.client_name || newCreds.email || newCreds.customer_code || newCreds.login_id || '';
    const rawApiKey = newCreds.api_key || newCreds.license_key || newCreds.token || newCreds.api_token || '';
    data.api_key = rawApiKey ? '••••••••' + String(rawApiKey).slice(-4) : '';
    data.api_secret = (newCreds.api_secret || newCreds.password) ? '••••••••' : '';
    data.mode = (updated.config?.sandbox_mode ?? (mode === 'sandbox')) ? 'sandbox' : 'live';
    return success(res, data);
  } catch (err) {
    next(err);
  }
};


/**
 * Toggle courier active status by provider_key.
 */
const toggleByKey = async (req, res, next) => {
  try {
    const { providerKey } = req.params;
    const platformAdminId = req.platformAdmin.id;

    let found = await courierProviderRepository.findByKey(providerKey);

    const displayNames = {
      shipway: 'Shipway Aggregator',
      stcourier: 'ST Courier (Tamil Nadu Express)',
      delhivery: 'Delhivery Express Direct',
      bluedart: 'Bluedart DHL Logistics',
      xpressbees: 'Xpressbees Direct',
      ecomexpress: 'Ecom Express',
      shadowfax: 'Shadowfax Hyperlocal & Forward',
    };

    if (!found) {
      found = await courierProviderService.onboard({
        provider_key: providerKey,
        display_name: displayNames[providerKey] || providerKey.toUpperCase(),
        supports_cod: true,
        supports_prepaid: true,
        credentials: {},
        config: { sandbox_mode: true },
        is_active: req.body.is_active ?? true,
      }, platformAdminId, req);
    }

    const { is_active } = req.body;
    const updated = await courierProviderService.toggle(found.id, is_active, platformAdminId, req);
    const data = updated.toJSON();
    delete data.credentials_encrypted;
    data.credentials = '***MASKED***';
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * Test real connection for a provider by its provider_key.
 * Decrypts stored credentials and calls the adapter's healthCheck() method.
 */
const testByKey = async (req, res, next) => {
  try {
    const { providerKey } = req.params;

    const { CourierProvider } = require('../models');
    const found = await CourierProvider.unscoped().findOne({ where: { provider_key: providerKey } });
    if (!found) {
      return error(res, { code: 'NOT_FOUND', message: `Provider '${providerKey}' has not been onboarded yet. Save credentials first.` }, 404);
    }

    if (!found.credentials_encrypted) {
      return error(res, { code: 'BAD_REQUEST', message: 'No credentials found. Save your API credentials first before testing.' }, 400);
    }

    const startTime = Date.now();
    let credentials;
    try {
      credentials = providerCredentialService.decrypt(found.credentials_encrypted);
    } catch {
      return error(res, { code: 'BAD_REQUEST', message: 'Failed to decrypt stored credentials. Please re-save them.' }, 400);
    }

    const adapter = await ProviderFactory.getAdapter(found.provider_key, credentials, found.config || {}, found.id);
    const result = await adapter.healthCheck();
    const latency = Date.now() - startTime;

    if (result.success && result.data && result.data.healthy) {
      return success(res, {
        status: 'success',
        provider: providerKey,
        latency_ms: latency,
        message: `✅ ${found.display_name || providerKey.toUpperCase()} API connection verified successfully! (${latency}ms)`,
      });
    } else {
      const msg = result.error?.message || 'Adapter reported unhealthy';
      return error(res, { code: 'CONNECTION_FAILED', message: `❌ ${providerKey.toUpperCase()} test failed: ${msg}` }, 400);
    }
  } catch (err) {
    return error(res, { code: 'CONNECTION_FAILED', message: `Connection test failed: ${err.message}` }, 400);
  }
};

const courierRoutingService = require('../services/courierRouting.service');

const getRoutingRules = async (req, res, next) => {
  try {
    const rules = courierRoutingService.getRoutingRules();
    return success(res, rules);
  } catch (err) {
    next(err);
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }
    const logoUrl = `/uploads/couriers/${req.file.filename}`;
    return success(res, { url: logoUrl, filename: req.file.filename });
  } catch (err) {
    return error(res, { code: 'UPLOAD_FAILED', message: err.message }, 500);
  }
};

const uploadLogoByKey = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }
    const { providerKey } = req.params;
    const logoUrl = `/uploads/couriers/${req.file.filename}`;
    const platformAdminId = req.platformAdmin?.id;

    let found = await courierProviderRepository.findByKey(providerKey, true);
    if (found) {
      await courierProviderService.update(found.id, { logo_url: logoUrl }, platformAdminId, req);
    }

    return success(res, {
      url: logoUrl,
      provider_key: providerKey,
      filename: req.file.filename,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  getById,
  onboard,
  update,
  toggle,
  healthCheck,
  healthLogs,
  grantAccess,
  revokeAccess,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  updateByKey,
  toggleByKey,
  testByKey,
  getRoutingRules,
  uploadLogo,
  uploadLogoByKey,
};


