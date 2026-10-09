'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const {
  Order,
  OrderItem,
  OrderStatusHistory,
  PickupAddress,
  StorefrontConnection,
  StorefrontSyncLog,
  sequelize,
} = require('../models');
const storefrontOrderMapper = require('../services/storefrontOrderMapper.service');
const storefrontConnectionService = require('../services/storefrontConnection.service');
const shopifyConnectorService = require('../services/shopifyConnector.service');
const woocommerceConnectorService = require('../services/woocommerceConnector.service');
const eventBus = require('../events/eventBus');
const logger = require('../utils/logger');

const CONNECTORS = {
  shopify: shopifyConnectorService,
  woocommerce: woocommerceConnectorService,
};

/**
 * Ingest a mapped storefront order payload into Nanoshipy Order tables.
 */
async function ingestMappedOrder(connectionRecord, mapped, sourceTrigger = 'webhook') {
  const sellerId = connectionRecord.seller_id;
  const externalOrderId = mapped.external_order_id;

  // 1. Check duplicate by storefront_connection_id + external_order_id
  const existingOrder = await Order.findOne({
    where: {
      storefront_connection_id: connectionRecord.id,
      external_order_id: externalOrderId,
    },
  });

  if (existingOrder) {
    logger.info(`[StorefrontSync] Order already exists: ${mapped.order_reference} (ID: ${existingOrder.id}), skipping duplicate insert.`);
    return { status: 'skipped', orderId: existingOrder.id };
  }

  // 2. Resolve default pickup address for tenant
  let pickupAddress = await PickupAddress.findOne({
    where: { tenant_id: sellerId, is_active: true },
    order: [['is_default', 'DESC']],
  });

  // If seller has no pickup address yet, fallback to a system default record
  if (!pickupAddress) {
    logger.warn(`[StorefrontSync] Tenant ${sellerId} has no pickup address. Creating automated default.`);
    pickupAddress = await PickupAddress.create({
      tenant_id: sellerId,
      nickname: 'Default Primary Warehouse',
      contact_person: connectionRecord.store_name || 'Store Manager',
      contact_phone: '9999999999',
      address_line_1: 'Warehouse Address Pending Configuration',
      city: mapped.shipping_city || 'New Delhi',
      state: mapped.shipping_state || 'Delhi',
      pincode: '110001',
      country: 'India',
      is_default: true,
      is_active: true,
    });
  }

  // 3. Database transaction for Order + OrderItems + OrderStatusHistory
  const createdOrder = await sequelize.transaction(async (t) => {
    const orderData = {
      tenant_id: sellerId,
      order_reference: mapped.order_reference,
      pickup_address_id: pickupAddress.id,
      customer_name: mapped.customer_name,
      customer_phone: mapped.customer_phone,
      customer_email: mapped.customer_email,
      shipping_address_line1: mapped.shipping_address_line1,
      shipping_address_line2: mapped.shipping_address_line2,
      shipping_city: mapped.shipping_city,
      shipping_state: mapped.shipping_state,
      shipping_pincode: mapped.shipping_pincode,
      shipping_country: mapped.shipping_country,
      order_value: mapped.order_value,
      payment_mode: mapped.payment_mode,
      cod_amount: mapped.cod_amount,
      weight_kg: mapped.weight_kg,
      length_cm: mapped.length_cm,
      width_cm: mapped.width_cm,
      height_cm: mapped.height_cm,
      status: 'created',
      source: 'api',
      storefront_connection_id: connectionRecord.id,
      external_order_id: externalOrderId,
    };

    const order = await Order.create(orderData, { transaction: t });

    const orderItems = (mapped.items || []).map((item) => ({
      order_id: order.id,
      name: item.name || item.product_name,
      sku: item.sku || 'SKU-DEFAULT',
      quantity: item.quantity || 1,
      unit_price: item.unit_price || item.price || 0,
    }));

    if (orderItems.length > 0) {
      await OrderItem.bulkCreate(orderItems, { transaction: t });
    }

    await OrderStatusHistory.create({
      order_id: order.id,
      old_status: null,
      new_status: 'created',
      changed_by: null,
      note: `Imported via ${connectionRecord.platform} ${sourceTrigger}`,
    }, { transaction: t });

    return order;
  });

  // Emit event for websocket notification and dashboard push
  setImmediate(() => {
    eventBus.emit('order.created', createdOrder);
    eventBus.emit('storefront.order_imported', {
      order_id: createdOrder.id,
      storefront_connection_id: connectionRecord.id,
      platform: connectionRecord.platform,
    });
  });

  return { status: 'imported', orderId: createdOrder.id };
}

let storefrontWebhookWorker = null;
let storefrontOrderPollWorker = null;

if (process.env.USE_MOCK_REDIS !== 'true') {
  storefrontWebhookWorker = new Worker(
    'storefront-webhook-process',
    async (job) => {
      const { connectionId, platform, topic, payload } = job.data;
      logger.info(`[StorefrontWebhookWorker] Processing job ${job.id} for connection ${connectionId} [${platform} / ${topic}]`);

      const connectionRecord = await StorefrontConnection.findByPk(connectionId);
      if (!connectionRecord || connectionRecord.status !== 'connected') {
        logger.warn(`[StorefrontWebhookWorker] Connection ${connectionId} is invalid or inactive`);
        return;
      }

      try {
        const mapped = storefrontOrderMapper.mapOrder(platform, payload, connectionRecord.id);
        const result = await ingestMappedOrder(connectionRecord, mapped, 'webhook');
        logger.info(`[StorefrontWebhookWorker] Ingest result for order ${mapped.order_reference}: ${result.status}`);
      } catch (err) {
        logger.error(`[StorefrontWebhookWorker] Failed to ingest order: ${err.message}`, { stack: err.stack });
        throw err;
      }
    },
    { connection }
  );

  storefrontOrderPollWorker = new Worker(
    'storefront-order-poll',
    async (job) => {
      const { connectionId, trigger = 'scheduled' } = job.data;
      logger.info(`[StorefrontPollWorker] Starting order poll for connection ${connectionId} (${trigger})`);

      const connectionRecord = await StorefrontConnection.findByPk(connectionId);
      if (!connectionRecord || connectionRecord.status !== 'connected') {
        logger.warn(`[StorefrontPollWorker] Connection ${connectionId} not active — skipping`);
        return;
      }

      const syncLog = await StorefrontSyncLog.create({
        connection_id: connectionRecord.id,
        trigger: trigger === 'manual' ? 'manual' : 'scheduled',
        started_at: new Date(),
      });

      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const errors = [];

      try {
        const connector = CONNECTORS[connectionRecord.platform];
        if (!connector) {
          throw new Error(`Unsupported platform: ${connectionRecord.platform}`);
        }

        const decryptedToken = storefrontConnectionService.decryptToken(connectionRecord.access_token_encrypted);
        if (!decryptedToken) {
          throw new Error('Could not decrypt access credentials for storefront');
        }

        const sinceDate = connectionRecord.last_synced_at || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const orders = await connector.fetchOrdersSince(connectionRecord, decryptedToken, sinceDate);

        logger.info(`[StorefrontPollWorker] Fetched ${orders.length} orders from ${connectionRecord.platform}`);

        for (const rawOrder of orders) {
          try {
            const mapped = storefrontOrderMapper.mapOrder(connectionRecord.platform, rawOrder, connectionRecord.id);
            const result = await ingestMappedOrder(connectionRecord, mapped, trigger);
            if (result.status === 'imported') importedCount++;
            else skippedCount++;
          } catch (orderErr) {
            failedCount++;
            errors.push({ order: rawOrder.id || 'unknown', error: orderErr.message });
          }
        }

        await connectionRecord.update({ last_synced_at: new Date() });
        await syncLog.update({
          orders_fetched: orders.length,
          orders_imported: importedCount,
          orders_skipped: skippedCount,
          orders_failed: failedCount,
          error_details: errors.length > 0 ? errors : null,
          completed_at: new Date(),
        });

        logger.info(`[StorefrontPollWorker] Finished poll for ${connectionId}: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed`);
      } catch (err) {
        logger.error(`[StorefrontPollWorker] Sync error on connection ${connectionId}: ${err.message}`);
        await syncLog.update({
          orders_failed: failedCount + 1,
          error_details: [{ error: err.message }],
          completed_at: new Date(),
        });
        throw err;
      }
    },
    { connection }
  );
}

module.exports = {
  storefrontWebhookWorker,
  storefrontOrderPollWorker,
  ingestMappedOrder,
};
