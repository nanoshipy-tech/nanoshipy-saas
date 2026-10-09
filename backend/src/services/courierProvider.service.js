'use strict';

const courierProviderRepository = require('../repositories/courierProvider.repository');
const tenantCourierAccessRepository = require('../repositories/tenantCourierAccess.repository');
const providerCredentialService = require('./providerCredential.service');
const platformAuditService = require('./platformAudit.service');
const { Tenant } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { ProviderCredentialsInvalidError } = require('../providers/errors');
const { credentialsSchemaMap } = require('../validators/courierProvider.validator');

const onboard = async (onboardData, platformAdminId, req = null) => {
  const {
    provider_key,
    display_name,
    logo_url,
    credentials,
    config,
    supports_cod,
    supports_prepaid,
    max_weight_kg,
    service_types,
    priority,
  } = onboardData;

  // Double check credentials format
  const schema = credentialsSchemaMap[provider_key];
  if (schema && credentials && Object.keys(credentials).length > 0) {
    const { error } = schema.validate(credentials);
    if (error) {
      throw new ProviderCredentialsInvalidError(`Credentials validation failed: ${error.message}`);
    }
  }

  // Encrypt credentials
  const credentials_encrypted = providerCredentialService.encrypt(credentials);

  const provider = await courierProviderRepository.create({
    provider_key,
    display_name,
    logo_url,
    credentials_encrypted,
    config,
    supports_cod,
    supports_prepaid,
    max_weight_kg,
    service_types,
    priority,
    created_by: platformAdminId,
    is_active: false, // Onboard as inactive by default
  });

  // Log Platform Audit Trail
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'courier_provider_created',
    entity_type: 'CourierProvider',
    entity_id: provider.id,
    metadata: {
      provider_key,
      display_name,
      supports_cod,
      supports_prepaid,
      max_weight_kg,
      service_types,
      priority,
    },
    ip_address: req ? req.ip : null,
  });

  return provider;
};

const update = async (id, updateData, platformAdminId, req = null) => {
  const provider = await courierProviderRepository.findById(id, true);
  if (!provider) {
    throw new NotFoundError('Courier provider not found');
  }

  const oldValues = {
    display_name: provider.display_name,
    logo_url: provider.logo_url,
    config: { ...provider.config },
    supports_cod: provider.supports_cod,
    supports_prepaid: provider.supports_prepaid,
    max_weight_kg: provider.max_weight_kg,
    service_types: provider.service_types,
    priority: provider.priority,
  };

  const payload = { ...updateData };

  // Handle credentials encryption if passed and not masked/empty
  if (payload.credentials) {
    const isMaskedOrEmpty =
      typeof payload.credentials === 'string' ||
      !payload.credentials ||
      Object.keys(payload.credentials).length === 0 ||
      Object.values(payload.credentials).every(v => v === '***MASKED***' || v === '' || v === null);

    if (isMaskedOrEmpty) {
      delete payload.credentials;
      delete payload.credentials_encrypted;
    } else {
      const schema = credentialsSchemaMap[provider.provider_key];
      if (schema) {
        const { error } = schema.validate(payload.credentials);
        if (error) {
          throw new ProviderCredentialsInvalidError(`Credentials validation failed: ${error.message}`);
        }
      }
      payload.credentials_encrypted = providerCredentialService.encrypt(payload.credentials);
      delete payload.credentials;
    }
  }

  const updatedProvider = await courierProviderRepository.update(id, payload);

  // Log Platform Audit Trail
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'courier_provider_updated',
    entity_type: 'CourierProvider',
    entity_id: id,
    metadata: {
      changes: Object.keys(updateData),
      old: oldValues,
      new: {
        display_name: updatedProvider.display_name,
        logo_url: updatedProvider.logo_url,
        config: updatedProvider.config,
        supports_cod: updatedProvider.supports_cod,
        supports_prepaid: updatedProvider.supports_prepaid,
        max_weight_kg: updatedProvider.max_weight_kg,
        service_types: updatedProvider.service_types,
        priority: updatedProvider.priority,
      },
    },
    ip_address: req ? req.ip : null,
  });

  return updatedProvider;
};

const toggle = async (id, isActive, platformAdminId, req = null) => {
  const provider = await courierProviderRepository.findById(id);
  if (!provider) {
    throw new NotFoundError('Courier provider not found');
  }

  const updatedProvider = await courierProviderRepository.update(id, { is_active: isActive });

  // Log Platform Audit Trail
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'courier_provider_toggled',
    entity_type: 'CourierProvider',
    entity_id: id,
    metadata: {
      provider_key: provider.provider_key,
      is_active: isActive,
    },
    ip_address: req ? req.ip : null,
  });

  return updatedProvider;
};

const grantTenantAccess = async (providerId, tenantId, platformAdminId, req = null) => {
  const provider = await courierProviderRepository.findById(providerId);
  if (!provider) {
    throw new NotFoundError('Courier provider not found');
  }

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const [access, created] = await tenantCourierAccessRepository.grantAccess(tenantId, providerId);

  // Log Platform Audit Trail
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'tenant_courier_access_granted',
    target_tenant_id: tenantId,
    entity_type: 'TenantCourierAccess',
    entity_id: access.id,
    metadata: {
      courier_provider_id: providerId,
      provider_key: provider.provider_key,
      display_name: provider.display_name,
    },
    ip_address: req ? req.ip : null,
  });

  return access;
};

const revokeTenantAccess = async (providerId, tenantId, platformAdminId, req = null) => {
  const provider = await courierProviderRepository.findById(providerId);
  if (!provider) {
    throw new NotFoundError('Courier provider not found');
  }

  await tenantCourierAccessRepository.revokeAccess(tenantId, providerId);

  // Log Platform Audit Trail
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'tenant_courier_access_revoked',
    target_tenant_id: tenantId,
    entity_type: 'TenantCourierAccess',
    entity_id: null,
    metadata: {
      courier_provider_id: providerId,
      provider_key: provider.provider_key,
      display_name: provider.display_name,
    },
    ip_address: req ? req.ip : null,
  });

  return { success: true };
};

const getForTenant = async (tenantId) => {
  const accessRecords = await tenantCourierAccessRepository.listByTenant(tenantId);
  // Extract and return just the provider details
  return accessRecords.map(record => record.provider);
};

const computeDynamicCourierScore = async (providerId) => {
  const { getRedisClient } = require('../config/redis.config');
  const redis = getRedisClient();
  const cacheKey = `courier_score:${providerId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return parseFloat(cached);
    } catch (e) {}
  }

  const { Shipment, NdrEvent, WeightDiscrepancyDispute } = require('../models');
  const { Op } = require('sequelize');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Total shipments in last 30 days
  const totalShipments = await Shipment.count({
    where: { courier_provider_id: providerId, created_at: { [Op.gte]: thirtyDaysAgo } }
  });

  if (totalShipments === 0) {
    const defaultScore = 88.0;
    if (redis) {
      try { await redis.set(cacheKey, defaultScore, 'EX', 21600); } catch (e) {}
    }
    return defaultScore;
  }

  // Delivered shipments for SLA %
  const deliveredCount = await Shipment.count({
    where: {
      courier_provider_id: providerId,
      status: 'delivered',
      created_at: { [Op.gte]: thirtyDaysAgo }
    }
  });
  const deliverySlaPct = Math.min(100, Math.round((deliveredCount / totalShipments) * 100));

  // NDR %
  const ndrCount = await NdrEvent.count({
    include: [{
      model: Shipment,
      where: { courier_provider_id: providerId, created_at: { [Op.gte]: thirtyDaysAgo } }
    }]
  }).catch(() => 0);
  const ndrPct = Math.min(100, Math.round((ndrCount / totalShipments) * 100));

  // Dispute %
  let disputePct = 0;
  if (WeightDiscrepancyDispute) {
    const disputeCount = await WeightDiscrepancyDispute.count({
      include: [{
        model: Shipment,
        where: { courier_provider_id: providerId, created_at: { [Op.gte]: thirtyDaysAgo } }
      }]
    }).catch(() => 0);
    disputePct = Math.min(100, Math.round((disputeCount / totalShipments) * 100));
  }

  // Formula: score = (delivery_sla_pct * 0.40) + ((100 - ndr_pct) * 0.35) + ((100 - dispute_pct) * 0.25)
  const score = Math.round(
    ((deliverySlaPct * 0.40) + ((100 - ndrPct) * 0.35) + ((100 - disputePct) * 0.25)) * 10
  ) / 10;

  if (redis) {
    try { await redis.set(cacheKey, score, 'EX', 21600); } catch (e) {}
  }

  return score;
};

module.exports = {
  onboard,
  update,
  toggle,
  grantTenantAccess,
  revokeTenantAccess,
  getForTenant,
  computeDynamicCourierScore,
};
