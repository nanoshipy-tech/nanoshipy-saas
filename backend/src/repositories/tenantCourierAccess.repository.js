'use strict';

const { TenantCourierAccess, CourierProvider } = require('../models');

const grantAccess = async (tenantId, courierProviderId, transaction = null) => {
  return TenantCourierAccess.findOrCreate({
    where: { tenant_id: tenantId, courier_provider_id: courierProviderId },
    defaults: { is_enabled: true },
    transaction,
  });
};

const revokeAccess = async (tenantId, courierProviderId, transaction = null) => {
  return TenantCourierAccess.destroy({
    where: { tenant_id: tenantId, courier_provider_id: courierProviderId },
    transaction,
  });
};

const listByTenant = async (tenantId) => {
  return TenantCourierAccess.findAll({
    where: { tenant_id: tenantId, is_enabled: true },
    include: [
      {
        model: CourierProvider,
        as: 'provider',
        where: { is_active: true }, // Only retrieve globally active providers
        attributes: [
          'id',
          'provider_key',
          'display_name',
          'logo_url',
          'supports_cod',
          'supports_prepaid',
          'max_weight_kg',
          'service_types',
          'priority',
        ],
      },
    ],
  });
};

const listByProvider = async (courierProviderId) => {
  return TenantCourierAccess.findAll({
    where: { courier_provider_id: courierProviderId },
  });
};

const exists = async (tenantId, courierProviderId) => {
  const access = await TenantCourierAccess.findOne({
    where: { tenant_id: tenantId, courier_provider_id: courierProviderId },
  });
  return !!access;
};

module.exports = {
  grantAccess,
  revokeAccess,
  listByTenant,
  listByProvider,
  exists,
};
