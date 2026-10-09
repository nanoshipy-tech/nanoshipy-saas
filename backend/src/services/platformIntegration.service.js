'use strict';

const { PlatformIntegration, TenantIntegrationConfig, Tenant } = require('../models');
const IntegrationFactory = require('../integrations/IntegrationFactory');
const orderService = require('./order.service');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class PlatformIntegrationService {
  /**
   * List global platform integration catalogue
   */
  async listCatalogue() {
    return PlatformIntegration.findAll({ order: [['created_at', 'ASC']] });
  }

  /**
   * Enable/disable integration globally (Admin)
   */
  async toggleIntegrationGlobal(id, is_active) {
    const integration = await PlatformIntegration.findByPk(id);
    if (!integration) throw new NotFoundError('Platform integration not found');
    await integration.update({ is_active });
    return integration;
  }

  /**
   * List connected integrations for a tenant
   */
  async getTenantConfigs(tenantId) {
    return TenantIntegrationConfig.findAll({
      where: { tenant_id: tenantId },
      include: [{ model: PlatformIntegration, as: 'integration' }],
    });
  }

  /**
   * Save or update store credentials for a tenant
   */
  async saveTenantConfig(tenantId, data) {
    const { platform_integration_id, store_url, credentials, sync_orders_automatically } = data;
    
    const integration = await PlatformIntegration.findByPk(platform_integration_id);
    if (!integration) throw new NotFoundError('Platform integration not found');

    const encryptedCreds = IntegrationFactory.encryptCredentials(credentials || {});

    const [config, created] = await TenantIntegrationConfig.findOrCreate({
      where: {
        tenant_id: tenantId,
        platform_integration_id,
      },
      defaults: {
        credentials_encrypted: encryptedCreds,
        store_url,
        is_active: true,
        sync_orders_automatically: sync_orders_automatically !== false,
      },
    });

    if (!created) {
      await config.update({
        credentials_encrypted: encryptedCreds,
        store_url: store_url || config.store_url,
        is_active: true,
        sync_orders_automatically: sync_orders_automatically !== undefined ? sync_orders_automatically : config.sync_orders_automatically,
      });
    }

    return config;
  }

  /**
   * Sync orders from tenant's external store
   */
  async syncStoreOrders(tenantId, configId) {
    const config = await TenantIntegrationConfig.findOne({
      where: { id: configId, tenant_id: tenantId },
      include: [{ model: PlatformIntegration, as: 'integration' }],
    });
    if (!config) throw new NotFoundError('Store connection config not found');

    const key = config.integration?.integration_key;
    const adapter = IntegrationFactory.createAdapter(key, config);

    try {
      const externalOrders = await adapter.fetchOrders({ limit: 50 });
      let createdCount = 0;

      for (const extOrder of externalOrders) {
        // Reuse existing orderService so validation & deduplication remain consistent
        try {
          await orderService.createOrder({
            tenant_id: tenantId,
            order_number: extOrder.order_number,
            customer_name: extOrder.customer_name,
            customer_email: extOrder.customer_email,
            customer_phone: extOrder.customer_phone,
            shipping_address: extOrder.shipping_address,
            total_amount: extOrder.total_amount,
            payment_method: extOrder.payment_method,
            items: extOrder.items,
            channel: key,
          });
          createdCount++;
        } catch (err) {
          logger.warn(`[PlatformIntegrationService] Skipping order ${extOrder.order_number}: ${err.message}`);
        }
      }

      await config.update({
        last_sync_at: new Date(),
        last_sync_status: 'success',
      });

      return { success: true, synced_count: createdCount, total_fetched: externalOrders.length };
    } catch (err) {
      await config.update({
        last_sync_at: new Date(),
        last_sync_status: 'failed',
      });
      throw err;
    }
  }
}

module.exports = new PlatformIntegrationService();
