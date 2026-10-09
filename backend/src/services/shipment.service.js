'use strict';

const db = require('../config/db.config');
const { Shipment, Order, CourierProvider, ShipmentRateQuote } = require('../models');
const {
  OrderNotShippableError,
  RateQuoteExpiredError,
  ProviderShipmentCreationFailedError,
  ShipmentNotCancellableError,
  NotFoundError,
  InsufficientBalanceError,
  BadRequestError,
} = require('../utils/errors');
const shipmentStatusService = require('./shipmentStatus.service');
const orderStatusService = require('./orderStatus.service');
const providerCredentialService = require('./providerCredential.service');
const ProviderFactory = require('../providers/ProviderFactory');
const fileUploadService = require('./fileUpload.service');
const labelGenerationService = require('./labelGeneration.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const axios = require('axios');
const { Op } = require('sequelize');
const walletService = require('./wallet.service');
const planEnforcementService = require('./planEnforcement.service');
const SellerPaymentService = require('./sellerPayment.service');
const PostpaidBillingService = require('./postpaidBilling.service');
const eventBus = require('../events/eventBus');
let costTrackingService;
try { costTrackingService = require('./costTracking.service'); } catch (_) {}
let notificationDispatcher;
try { notificationDispatcher = require('./notificationDispatcher.service'); } catch (_) {}

const createShipment = async (data, tenantIdParam, userIdParam, req = null) => {
  const { order_id } = data;
  const service_type = data.service_type || data.carrier_id || (data.carrierId ? String(data.carrierId) : 'express');
  let { courier_provider_id, quoted_rate } = data;
  let tenantId = tenantIdParam || data.tenantId || data.tenant_id;
  const userId = userIdParam || data.userId || data.user_id;

  return db.transaction(async (t) => {
    // 1. Load order and validate status first (resolves tenantId if initiated by platform admin)
    const orderWhere = { id: order_id };
    if (tenantId) orderWhere.tenant_id = tenantId;

    const order = await Order.findOne({
      where: orderWhere,
      include: ['pickupAddress'],
      transaction: t,
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Adopt order tenant_id if not explicitly provided
    tenantId = tenantId || order.tenant_id;

    // 0. Idempotency Guard: check if an active shipment already exists for this order
    const existingActiveShipment = await Shipment.findOne({
      where: {
        order_id,
        tenant_id: tenantId,
        status: { [Op.notIn]: ['cancelled', 'failed'] },
      },
      transaction: t,
    });

    if (existingActiveShipment) {
      logger.info(`[ShipmentService] Order ${order_id} already has active shipment ${existingActiveShipment.id} (${existingActiveShipment.awb_number}). Returning existing shipment.`);
      return existingActiveShipment;
    }

    if (!['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status)) {
      throw new OrderNotShippableError(`Order is in status "${order.status}" and cannot be shipped.`);
    }

    // Auto-transition pending/processing/cancelled orders to ready_to_ship
    if (order.status !== 'ready_to_ship') {
      await order.update({ status: 'ready_to_ship' }, { transaction: t });
    }

    // Auto-resolve courier_provider_id if omitted
    if (!courier_provider_id) {
      const shipwayProvider = await CourierProvider.findOne({
        where: { provider_key: 'shipway', is_active: true },
        transaction: t,
      });
      if (shipwayProvider) {
        courier_provider_id = shipwayProvider.id;
      } else {
        const anyActive = await CourierProvider.findOne({
          where: { is_active: true },
          order: [['updated_at', 'DESC']],
          transaction: t,
        });
        if (anyActive) courier_provider_id = anyActive.id;
      }
    }

    if (!quoted_rate) {
      quoted_rate = parseFloat(order.shipping_charge) || 45.00;
    }

    // 2. Validate quote or auto-generate quote for price verification
    let quote = await ShipmentRateQuote.findOne({
      where: {
        order_id,
        courier_provider_id,
        service_type,
      },
      order: [['quoted_at', 'DESC']],
      transaction: t,
    });

    if (quote && quote.expires_at && new Date(quote.expires_at) < new Date()) {
      throw new RateQuoteExpiredError('The rate quote for this shipment has expired. Please re-compare rates.');
    }

    if (!quote) {
      // Auto-create quote to ensure seamless booking flow
      const autoCod = order.payment_mode === 'cod' ? Math.max(40, parseFloat(order.cod_amount || order.order_value || 0) * 0.025) : 0;
      quote = await ShipmentRateQuote.create({
        id: require('uuid').v4(),
        order_id,
        courier_provider_id,
        service_type,
        price: quoted_rate,
        cod_charge: autoCod,
        estimated_days: 3,
        quoted_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      }, { transaction: t });
    }

    const quotePrice = parseFloat(quote.price);
    const quoteCod = (order.payment_mode === 'cod' && quote.cod_charge) ? parseFloat(quote.cod_charge) : 0;
    const quoteTotal = Math.round((quotePrice + quoteCod) * 100) / 100;

    const reqRate = parseFloat(quoted_rate);
    const isFreightMatch = Math.abs(quotePrice - reqRate) <= 0.50;
    const isTotalMatch = Math.abs(quoteTotal - reqRate) <= 0.50;

    if (!isFreightMatch && !isTotalMatch) {
      throw new RateQuoteExpiredError('The quoted shipping price has changed or is invalid. Please refresh rate quotes.');
    }

    // Total deduction includes courier freight rate + COD charge (if COD order)
    const totalDeduction = quoteTotal;

    // Check Subscription plan limit (Module 13 Hook)
    if (tenantId) {
      const planEnforcementService = require('./planEnforcement.service');
      await planEnforcementService.checkLimit(tenantId, 'max_orders_per_month').catch(pErr => {
        if (tenantIdParam) throw pErr;
        logger.warn(`[ShipmentService] Platform admin bypass plan limit check: ${pErr.message}`);
      });
    }

    // Two-Phase Payment Reservation (Prepaid Wallet or Postpaid Credit Limit)
    let paymentReserved = false;
    if (tenantId) {
      const authCheck = await SellerPaymentService.canBookShipment({
        tenant_id: tenantId,
        estimated_cost: totalDeduction,
      });

      if (!authCheck.allowed) {
        if (tenantIdParam) {
          throw new InsufficientBalanceError(authCheck.reason || 'Insufficient wallet balance or credit limit');
        }
        logger.warn(`[ShipmentService] Platform admin bypass payment check: ${authCheck.reason}`);
      } else {
        await SellerPaymentService.reserveShipmentPayment({
          tenant_id: tenantId,
          shipment_id: order.id,
          amount: totalDeduction,
          transaction: t,
        });
        paymentReserved = true;
      }
    }

    // 3. Resolve courier provider and credentials
    const provider = await CourierProvider.scope('withCredentials').findByPk(courier_provider_id, { transaction: t });
    if (!provider || !provider.is_active) {
      if (paymentReserved) {
        await SellerPaymentService.releaseShipmentPayment({
          tenant_id: tenantId,
          shipment_id: order.id,
          amount: totalDeduction,
          transaction: t,
        }).catch(() => {});
      }
      throw new NotFoundError('Courier provider not found or inactive');
    }

    // Pre-flight check (Issue #8): Verify pickup address is synced with Shipway before calling Shipway API
    if (provider.provider_key === 'shipway') {
      const warehouseId = order.pickupAddress?.shipway_location_id || order.pickupAddress?.warehouse_id;
      if (!warehouseId || String(warehouseId).trim() === '') {
        if (paymentReserved) {
          await SellerPaymentService.releaseShipmentPayment({
            tenant_id: tenantId,
            shipment_id: order.id,
            amount: totalDeduction,
            transaction: t,
          }).catch(() => {});
        }
        throw new BadRequestError(`Pickup address "${order.pickupAddress?.label || order.pickupAddress?.address_line1 || 'Default'}" is not linked to Shipway — add Warehouse Fulfillment Code / Hub ID before booking`);
      }
    }

    // 4. Book shipment with courier adapter (with safe fallback for dev/testing)
    let adapterResponse;
    try {
      const credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
      const adapter = await ProviderFactory.getAdapter(provider.provider_key, credentials, provider.config || {}, provider.id);

      const fullDeliveryAddress = [
        order.shipping_address_line1,
        order.shipping_address_line2,
        order.shipping_city,
        order.shipping_state,
        order.shipping_country || 'India',
      ].filter(Boolean).join(', ');

      adapterResponse = await adapter.createShipment({
        order: {
          id: order.id,
          order_reference: order.order_reference,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          delivery_address: fullDeliveryAddress,
          delivery_city: order.shipping_city,
          delivery_state: order.shipping_state,
          delivery_country: order.shipping_country || 'India',
          delivery_pincode: order.shipping_pincode,
          order_value: parseFloat(order.order_value),
          payment_mode: order.payment_mode,
          cod_amount: order.cod_amount ? parseFloat(order.cod_amount) : 0,
          weight: parseFloat(order.weight_kg),
          weight_kg: parseFloat(order.weight_kg),
          length_cm: parseFloat(order.length_cm || 10),
          width_cm: parseFloat(order.width_cm || 10),
          height_cm: parseFloat(order.height_cm || 10),
          length: parseFloat(order.length_cm || 10),
          width: parseFloat(order.width_cm || 10),
          height: parseFloat(order.height_cm || 10),
          box_length: parseFloat(order.length_cm || 10),
          box_breadth: parseFloat(order.width_cm || 10),
          box_height: parseFloat(order.height_cm || 10),
          items: order.items,
        },
        pickupAddress: order.pickupAddress,
        serviceType: service_type,
      });

      // Defense in depth: Simulated AWB booking is strictly restricted to automated unit/integration tests (NODE_ENV === 'test').
      // sandbox_mode in provider config must NEVER trigger fake AWB generation in a live production process.
      const isTestEnv = process.env.NODE_ENV === 'test' && (provider.provider_key === 'mock' || process.env.USE_MOCK_COURIER === 'true');

      if ((!adapterResponse || !adapterResponse.success) && isTestEnv) {
        logger.info(`[ShipmentService] [TEST_ENV] Live carrier call returned error. Generating simulated sandbox AWB for testing.`);
        adapterResponse = {
          success: true,
          data: {
            awbNumber: 'NS' + Math.floor(1000000000 + Math.random() * 9000000000),
            courierShipmentId: 'SHIP_' + Date.now(),
            labelUrl: null,
            estimatedPickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        };
      }
    } catch (err) {
      logger.error(`[ShipmentService] Carrier booking failed for ${provider.display_name}: ${err.message}`, { stack: err.stack });

      const isTestEnv = process.env.NODE_ENV === 'test' && (provider.provider_key === 'mock' || process.env.USE_MOCK_COURIER === 'true');

      if (isTestEnv) {
        adapterResponse = {
          success: true,
          data: {
            awbNumber: 'NS' + Math.floor(1000000000 + Math.random() * 9000000000),
            courierShipmentId: 'SHIP_' + Date.now(),
            labelUrl: null,
            estimatedPickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        };
      } else {
        if (paymentReserved) {
          await SellerPaymentService.releaseShipmentPayment({
            tenant_id: tenantId,
            shipment_id: order.id,
            amount: totalDeduction,
            transaction: t,
          }).catch(() => {});
        }
        throw new ProviderShipmentCreationFailedError(err.message || 'Carrier failed to create shipment');
      }
    }

    if (!adapterResponse || !adapterResponse.success) {
      if (paymentReserved) {
        await SellerPaymentService.releaseShipmentPayment({
          tenant_id: tenantId,
          shipment_id: order.id,
          amount: totalDeduction,
          transaction: t,
        }).catch(() => {});
      }
      throw new ProviderShipmentCreationFailedError(adapterResponse?.error?.message || 'Carrier failed to create shipment');
    }

    if (!adapterResponse.data || !adapterResponse.data.awbNumber) {
      if (paymentReserved) {
        await SellerPaymentService.releaseShipmentPayment({
          tenant_id: tenantId,
          shipment_id: order.id,
          amount: totalDeduction,
          transaction: t,
        }).catch(() => {});
      }
      throw new ProviderShipmentCreationFailedError('Carrier did not return a valid AWB number');
    }

    const { awbNumber, courierShipmentId, labelUrl, estimatedPickupDate } = adapterResponse.data;

    // 5. Re-host shipping label PDF from adapter
    let rehostedLabelUrl = labelUrl;
    if (labelUrl && labelUrl.startsWith('http')) {
      try {
        const fileResponse = await axios.get(labelUrl, { responseType: 'arraybuffer', timeout: 5000 });
        const buffer = Buffer.from(fileResponse.data);
        rehostedLabelUrl = await fileUploadService.uploadFile(
          buffer,
          'shipments/labels',
          `label-${awbNumber || order.order_reference}.pdf`,
          'application/pdf'
        );
      } catch (uploadErr) {
        logger.error('Failed to re-host shipping label PDF. Falling back to provider URL: ' + uploadErr.message);
      }
    }

    // 6. Create Shipment row
    const initialCostRate = Math.round((quotePrice / 1.30) * 100) / 100;
    const initialMargin = Math.round((quotePrice - initialCostRate) * 100) / 100;

    const rawPayload = Object.assign({}, adapterResponse.providerRawResponse || {});
    if (adapterResponse.data?.carrierName && !rawPayload.carrier_name) {
      rawPayload.carrier_name = adapterResponse.data.carrierName;
    }
    if (adapterResponse.data?.carrierTitle && !rawPayload.carrier_title) {
      rawPayload.carrier_title = adapterResponse.data.carrierTitle;
    }
    if (adapterResponse.data?.carrierId && !rawPayload.carrier_id) {
      rawPayload.carrier_id = adapterResponse.data.carrierId;
    }

    const shipment = await Shipment.create({
      tenant_id: tenantId,
      order_id,
      courier_provider_id,
      pickup_address_id: order.pickup_address_id,
      awb_number: awbNumber || null,
      courier_shipment_id: courierShipmentId || null,
      service_type,
      selected_rate: totalDeduction,
      sell_rate: quotePrice,
      cost_rate: initialCostRate,
      margin_amount: initialMargin,
      cod_charge: quoteCod,
      declared_weight_kg: order.weight_kg,
      status: awbNumber ? 'awb_generated' : 'created',
      label_url: rehostedLabelUrl || null,
      estimated_delivery_date: estimatedPickupDate ? new Date(estimatedPickupDate) : null,
      provider_raw_response: rawPayload,
      created_by: userId,
    }, { transaction: t });

    // Generate native NanoShipy branded shipping label (Issue #6)
    try {
      const brandedLabelUrl = await labelGenerationService.generateLabelForShipment(shipment.id, '4x6', true, t);
      if (brandedLabelUrl) {
        shipment.label_url = brandedLabelUrl;
        await shipment.save({ transaction: t });
      }
    } catch (lblErr) {
      logger.warn(`[ShipmentService] Native branded label generation notice: ${lblErr.message}`);
    }

    // Link ST Courier allocated AWB inventory record if applicable
    if (adapterResponse?.data?.allocationMeta?.awbId) {
      try {
        const { StCourierAwbInventory } = require('../models');
        await StCourierAwbInventory.update(
          { shipment_id: shipment.id },
          { where: { id: adapterResponse.data.allocationMeta.awbId }, transaction: t }
        );
      } catch (awbLinkErr) {
        logger.warn(`[ShipmentService] Failed to link StCourierAwbInventory to shipment ${shipment.id}: ${awbLinkErr.message}`);
      }
    }

    // Insert CostRateSnapshot for audit trail
    try {
      const { CostRateSnapshot } = require('../models');
      await CostRateSnapshot.create({
        shipment_id: shipment.id,
        courier_provider_id,
        cost_price: initialCostRate,
        sell_price: totalDeduction,
        margin_amount: initialMargin,
        margin_percent: totalDeduction > 0 ? Math.round((initialMargin / totalDeduction) * 10000) / 100 : 0,
        markup_percent_applied: 30.00,
        captured_at: new Date(),
      }, { transaction: t });
    } catch (snapshotErr) {
      logger.error(`[ShipmentService] CostRateSnapshot creation failed: ${snapshotErr.message}`);
    }

    // Two-Phase Payment Capture (Unified Prepaid / Postpaid)
    if (tenantId && paymentReserved) {
      const paymentDesc = quoteCod > 0
        ? `Shipping & COD charge for shipment ${shipment.id} (Freight: ₹${quotePrice}, COD: ₹${quoteCod})`
        : `Shipping charge for shipment ${shipment.id}`;

      await SellerPaymentService.captureShipmentPayment({
        tenant_id: tenantId,
        shipment_id: shipment.id,
        amount: totalDeduction,
        performedBy: userId,
        transaction: t,
        description: paymentDesc,
      });
    }

    // Increment subscription usage (Module 13 Hook)
    await planEnforcementService.incrementUsage(tenantId, 'max_orders_per_month', 1, t);


    // 7. Write shipment status history log
    await shipmentStatusService.logHistory(shipment.id, null, 'created', 'system', 'Shipment created from order', t);
    if (awbNumber) {
      await shipmentStatusService.logHistory(shipment.id, 'created', 'awb_generated', 'system', 'AWB successfully generated by carrier', t);
    }

    // 8. Update order status to shipped and log history
    await order.update({ status: 'shipped' }, { transaction: t });
    await orderStatusService.logHistory(order.id, 'ready_to_ship', 'shipped', userId, 'Order booked and shipped via courier aggregator', t);

    // 9. Write audit log
    await auditService.log({
      tenant_id: tenantId,
      user_id: userId,
      action: 'shipment_created',
      entity_type: 'Shipment',
      entity_id: shipment.id,
      metadata: {
        order_id,
        awb_number: awbNumber,
        courier_provider_id,
        selected_rate: totalDeduction,
        freight_rate: quotePrice,
        cod_charge: quoteCod,
      },
      req,
    });

    eventBus.emit('shipment.created', {
      tenant_id: tenantId,
      awb_number: awbNumber,
      provider_name: provider.display_name,
      order_reference: order.order_reference,
    });

    // Reconcile actual carrier cost asynchronously in the background
    setImmediate(() => {
      try {
        if (costTrackingService && typeof costTrackingService.reconcileShipmentCost === 'function') {
          costTrackingService.reconcileShipmentCost(shipment.id).catch(err => {
            logger.error(`[ShipmentService] Background cost reconciliation failed for shipment ${shipment.id}: ${err.message}`);
          });
        }
      } catch (e) {}

      try {
        if (notificationDispatcher && typeof notificationDispatcher.sendShipmentDispatchedNotification === 'function') {
          notificationDispatcher.sendShipmentDispatchedNotification(shipment).catch(err => {
            logger.error(`[ShipmentService] Tracking dispatch notification failed for shipment ${shipment.id}: ${err.message}`);
          });
        }
      } catch (e) {}

      // Auto-push fulfillment to Shopify if this order belongs to a tenant with a connected Shopify store
      try {
        if (awbNumber) {
          const { ShopifyConnection, StorefrontConnection } = require('../models');
          const shopifyIntegrationService = require('./shopifyIntegration.service');
          const storefrontConnSvc = require('./storefrontConnection.service');
          const shopifyConnSvc = require('./shopifyConnector.service');

          (async () => {
            // 1. Locate Shopify connection (by order's connection id or tenant's active connection)
            let conn = null;
            if (order.storefront_connection_id) {
              conn = await ShopifyConnection.findByPk(order.storefront_connection_id).catch(() => null);
            }
            if (!conn) {
              conn = await ShopifyConnection.findOne({
                where: { tenant_id: order.tenant_id, status: 'connected' },
                order: [['updated_at', 'DESC']],
              }).catch(() => null);
            }

            // 2. Resolve target Shopify order identifier
            let shopifyOrderId = order.external_order_id;
            if (!shopifyOrderId && order.order_reference) {
              const numMatch = order.order_reference.match(/^(?:SHP-)?#?(\d+)$/i);
              shopifyOrderId = numMatch ? numMatch[1] : order.order_reference;
            }

            const trackingUrl = `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`;
            const carrierName = provider.display_name || 'Courier';

            if (conn && conn.status === 'connected' && shopifyOrderId) {
              const decryptedToken = shopifyIntegrationService.decryptToken(conn.access_token);
              if (decryptedToken) {
                const result = await shopifyIntegrationService.fulfillOrder(
                  conn,
                  decryptedToken,
                  shopifyOrderId,
                  awbNumber,
                  carrierName,
                  trackingUrl
                );

                if (result && result.success) {
                  logger.info(`[ShipmentService] Shopify fulfillment pushed for order ${shopifyOrderId}, AWB=${awbNumber}, fulfillmentId=${result.fulfillmentId || result.fulfillment_id}`);
                  return;
                } else {
                  logger.warn(`[ShipmentService] Shopify fulfillment push warning for order ${shopifyOrderId}: ${result?.error}`);
                }
              }
            }

            // 3. Fallback to legacy StorefrontConnection if present
            if (StorefrontConnection && shopifyOrderId) {
              let legacyConn = null;
              if (order.storefront_connection_id) {
                legacyConn = await StorefrontConnection.findByPk(order.storefront_connection_id).catch(() => null);
              }
              if (!legacyConn) {
                legacyConn = await StorefrontConnection.findOne({
                  where: { tenant_id: order.tenant_id, platform: 'shopify', status: 'connected' },
                  order: [['updated_at', 'DESC']],
                }).catch(() => null);
              }

              if (legacyConn && legacyConn.status === 'connected') {
                const decryptedToken = storefrontConnSvc.decryptToken(legacyConn.access_token_encrypted);
                if (decryptedToken) {
                  const result = await shopifyConnSvc.fulfillOrder(
                    legacyConn,
                    decryptedToken,
                    shopifyOrderId,
                    awbNumber,
                    carrierName,
                    trackingUrl
                  );
                  if (result && result.success) {
                    logger.info(`[ShipmentService] Legacy Shopify fulfillment pushed for order ${shopifyOrderId}, AWB=${awbNumber}`);
                  }
                }
              }
            }
          })().catch(err => {
            logger.warn(`[ShipmentService] Shopify fulfillment push background error: ${err.message}`);
          });
        }
      } catch (e) {
        logger.warn(`[ShipmentService] Shopify fulfillment push setup error: ${e.message}`);
      }
    });

    return shipment;
  });
};

const cancelShipment = async (id, tenantId, userId, req = null) => {
  return db.transaction(async (t) => {
    // 1. Load shipment
    const shipment = await Shipment.findOne({
      where: { id, tenant_id: tenantId },
      include: [{ model: Order, as: 'order' }],
      transaction: t,
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    // 2. Verify shipment state is cancellable (pre-pickup only)
    if (shipment.status === 'cancelled') {
      return {
        shipment: shipment.toJSON(),
        refund: { amount: 0, status: 'already_cancelled' },
        message: 'Shipment is already cancelled.',
      };
    }

    const cancellableStatuses = [
      'created',
      'awb_generated',
      'pickup_scheduled',
      'manifested',
      'pickup_generated',
      'processing',
      'booked',
      'ready_for_pickup'
    ];

    if (!cancellableStatuses.includes(shipment.status)) {
      throw new ShipmentNotCancellableError(`Shipment is in status "${shipment.status}" and cannot be cancelled.`);
    }

    // 3. Decrypt credentials and call adapter.cancelShipment
    const provider = await CourierProvider.scope('withCredentials').findByPk(shipment.courier_provider_id, { transaction: t });
    if (!provider) {
      throw new NotFoundError('Courier provider not found');
    }

    let adapterResponse;
    const isMockOrSimulatedAwb = !shipment.awb_number || /^NS[0-9A-Z]/i.test(shipment.awb_number) || /^MOCK/i.test(shipment.awb_number) || /^TEST/i.test(shipment.awb_number);

    if (isMockOrSimulatedAwb || provider.config?.sandbox_mode || provider.provider_key === 'mock') {
      logger.info(`[ShipmentService] Skipping external carrier cancellation for simulated/sandbox AWB: ${shipment.awb_number}`);
      adapterResponse = { success: true, message: 'Cancelled in sandbox/mock mode' };
    } else {
      try {
        let credentials = {};
        try {
          if (provider.credentials_encrypted) {
            credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
          }
        } catch (decErr) {
          logger.warn('[ShipmentService] Could not decrypt credentials during cancel: ' + decErr.message);
        }
        const adapter = await ProviderFactory.getAdapter(provider.provider_key, credentials, provider.config || {}, provider.id);
        adapterResponse = await adapter.cancelShipment({
          awbNumber: shipment.awb_number,
          orderId: shipment.order?.order_reference || shipment.courier_shipment_id || shipment.order_id,
          courierShipmentId: shipment.courier_shipment_id || shipment.order?.order_reference,
        });
      } catch (err) {
        logger.warn('[ShipmentService] Adapter notice during cancelShipment: ' + err.message);
        adapterResponse = { success: false, warning: err.message };
      }
    }

    if (adapterResponse && !adapterResponse.success) {
      const errMsg = adapterResponse?.error?.message || adapterResponse?.warning || 'Courier cancel booking notice from carrier network';
      logger.warn(`[ShipmentService] Carrier cancel notice (proceeding with local cancellation): ${errMsg}`);
    }

    // 4. Update shipment status to cancelled and log history
    const oldStatus = shipment.status;
    await shipment.update({ status: 'cancelled' }, { transaction: t });
    await shipmentStatusService.logHistory(shipment.id, oldStatus, 'cancelled', 'manual', 'Cancelled by tenant user request', t);

    // Credit refund or postpaid debt adjustment
    const paymentProfile = await SellerPaymentService.getPaymentProfile(tenantId, t);
    if (paymentProfile && paymentProfile.payment_mode === 'postpaid') {
      await PostpaidBillingService.recordPayment({
        tenantId,
        amount: shipment.selected_rate,
        paymentMethod: 'manual_adjustment',
        paymentReference: `REFUND-${shipment.awb_number || shipment.id}`,
        notes: `Credit adjustment for cancelled shipment ${shipment.id}`,
        adminId: userId,
      });
    } else {
      await walletService.credit(tenantId, shipment.selected_rate, 'shipment_refund', shipment.id, `Refund for cancelled AWB: ${shipment.awb_number || 'N/A'}`, userId, t);
    }

    // Generate cancellation credit note (non-blocking)
    try {
      const creditNoteService = require('./creditNote.service');
      await creditNoteService.createCancellationCreditNote(shipment.id, 'Shipment cancelled by tenant request', t);
    } catch (cnErr) {
      logger.error(`[ShipmentService] Credit note generation failed (non-blocking): ${cnErr.message}`);
    }

    // 5. Revert order status back to ready_to_ship so it can be re-shipped
    let order = shipment.order;
    if (!order && shipment.order_id) {
      order = await Order.findOne({ where: { id: shipment.order_id }, transaction: t });
    }
    if (order) {
      const oldOrderStatus = order.status;
      await order.update({ status: 'ready_to_ship' }, { transaction: t });
      await orderStatusService.logHistory(order.id, oldOrderStatus, 'ready_to_ship', userId, 'Order status reverted on shipment cancellation', t);
    }

    // 6. Write audit log
    await auditService.log({
      tenant_id: tenantId,
      user_id: userId,
      action: 'shipment_cancelled',
      entity_type: 'Shipment',
      entity_id: shipment.id,
      metadata: {
        awb_number: shipment.awb_number,
        order_id: shipment.order_id,
      },
      req,
    });

    const eventBus = require('../events/eventBus');
    eventBus.emit('shipment.cancelled', {
      tenant_id: tenantId,
      awb_number: shipment.awb_number,
      refund_amount: shipment.selected_rate,
    });

    return { success: true };

  });
};

const createRtoShipment = async (data, tenantId, userId) => {
  const { forward_shipment_id, reason } = data;
  return db.transaction(async (t) => {
    const forwardShipment = await Shipment.findOne({
      where: { id: forward_shipment_id, tenant_id: tenantId },
      include: [{ model: Order, as: 'order' }],
      transaction: t,
    });

    if (!forwardShipment) {
      throw new NotFoundError('Forward shipment not found');
    }

    const provider = await CourierProvider.scope('withCredentials').findByPk(forwardShipment.courier_provider_id, { transaction: t });
    const rtoRate = parseFloat(forwardShipment.selected_rate || 50.00);

    // Check wallet balance
    await walletService.checkBalanceForShipment(tenantId, rtoRate, t);

    // Link return AWB to forward shipment AWB for seamless tracking
    const rtoAwb = forwardShipment.awb_number ? `RTO-${forwardShipment.awb_number}` : `RTO-${Date.now()}`;
    const costRate = forwardShipment.cost_rate ? parseFloat(forwardShipment.cost_rate) : Math.round(rtoRate * 0.85 * 100) / 100;
    const marginAmount = Math.max(0, Math.round((rtoRate - costRate) * 100) / 100);

    const rtoShipment = await Shipment.create({
      tenant_id: tenantId,
      order_id: forwardShipment.order_id,
      parent_shipment_id: forwardShipment.id,
      courier_provider_id: forwardShipment.courier_provider_id,
      pickup_address_id: forwardShipment.pickup_address_id,
      awb_number: rtoAwb,
      courier_shipment_id: 'RTO-' + Date.now(),
      service_type: 'rto',
      selected_rate: rtoRate,
      sell_rate: rtoRate,
      cost_rate: costRate,
      margin_amount: marginAmount,
      declared_weight_kg: forwardShipment.declared_weight_kg,
      status: 'rto_initiated',
      created_by: userId,
    }, { transaction: t });

    // Deduct wallet for RTO leg
    await walletService.debit(tenantId, rtoRate, 'rto_debit', rtoShipment.id, `RTO fee for AWB: ${rtoAwb}`, userId, t);

    // Write history
    await shipmentStatusService.logHistory(rtoShipment.id, null, 'rto_initiated', 'system', reason || 'RTO initiated for order', t);

    return rtoShipment;
  });
};

const createReverseShipment = async (data, tenantId, userId) => {
  const { forward_shipment_id, courier_provider_id, service_type = 'reverse', quoted_rate = 60.00 } = data;
  return db.transaction(async (t) => {
    const forwardShipment = await Shipment.findOne({
      where: { id: forward_shipment_id, tenant_id: tenantId },
      include: [{ model: Order, as: 'order' }],
      transaction: t,
    });

    if (!forwardShipment) {
      throw new NotFoundError('Forward shipment not found');
    }

    if (forwardShipment.status !== 'delivered') {
      throw new Error('Reverse pickup can only be requested after the forward shipment is delivered.');
    }

    const providerId = courier_provider_id || forwardShipment.courier_provider_id;

    // Check wallet balance
    await walletService.checkBalanceForShipment(tenantId, quoted_rate, t);

    const reverseAwb = 'REV' + Math.floor(100000000 + Math.random() * 900000000);

    const reverseShipment = await Shipment.create({
      tenant_id: tenantId,
      order_id: forwardShipment.order_id,
      parent_shipment_id: forwardShipment.id,
      courier_provider_id: providerId,
      pickup_address_id: forwardShipment.pickup_address_id,
      awb_number: reverseAwb,
      courier_shipment_id: 'REV-' + Date.now(),
      service_type,
      selected_rate: quoted_rate,
      sell_rate: quoted_rate,
      cost_rate: Math.round((quoted_rate / 1.30) * 100) / 100,
      margin_amount: Math.round((quoted_rate - (quoted_rate / 1.30)) * 100) / 100,
      declared_weight_kg: forwardShipment.declared_weight_kg,
      status: 'reverse_requested',
      created_by: userId,
    }, { transaction: t });

    // Deduct wallet for reverse pickup leg
    await walletService.debit(tenantId, quoted_rate, 'reverse_debit', reverseShipment.id, `Reverse pickup charge for AWB: ${reverseAwb}`, userId, t);

    // Write history
    await shipmentStatusService.logHistory(reverseShipment.id, null, 'reverse_requested', 'user', 'Reverse pickup request approved', t);

    return reverseShipment;
  });
};

const getOrderThread = async (orderId, tenantId) => {
  const { Order, Shipment, TrackingEvent, NdrEvent, WalletTransaction, WeightDiscrepancyDispute } = require('../models');

  const order = await Order.findOne({
    where: { id: orderId, tenant_id: tenantId },
    include: [
      'items',
      'pickupAddress',
      {
        model: Shipment,
        as: 'shipments',
        include: [
          'provider',
          'trackingEvents',
          'parentShipment',
          'childShipments',
        ],
      },
    ],
  });

  if (!order) {
    throw new NotFoundError('Order thread not found');
  }

  // Gather shipment IDs
  const shipmentIds = (order.shipments || []).map(s => s.id);

  const walletTransactions = await WalletTransaction.findAll({
    where: { tenant_id: tenantId, reference_id: shipmentIds },
    order: [['created_at', 'DESC']],
  });

  const ndrEvents = await NdrEvent.findAll({
    where: { tenant_id: tenantId, shipment_id: shipmentIds },
  });

  const weightDisputes = await WeightDiscrepancyDispute.findAll({
    where: { seller_id: tenantId, shipment_id: shipmentIds },
  });

  return {
    order,
    shipments: order.shipments,
    wallet_transactions: walletTransactions,
    ndr_events: ndrEvents,
    weight_disputes: weightDisputes,
  };
};

const getShipmentSummary = async (tenantId) => {
  const where = {};
  if (tenantId) where.tenant_id = tenantId;
  const result = await Shipment.findAll({
    where,
    attributes: [
      [db.fn('COUNT', db.col('id')), 'count'],
      'status',
    ],
    group: ['status'],
    raw: true,
  });

  // Construct summary counters object
  const summary = {
    created: 0,
    awb_generated: 0,
    pickup_scheduled: 0,
    picked_up: 0,
    in_transit: 0,
    out_for_delivery: 0,
    delivered: 0,
    ndr: 0,
    rto_initiated: 0,
    rto_in_transit: 0,
    rto_delivered: 0,
    reverse_requested: 0,
    reverse_scheduled: 0,
    reverse_in_transit: 0,
    reverse_delivered: 0,
    cancelled: 0,
    failed: 0,
  };

  result.forEach(row => {
    if (row.status in summary) {
      summary[row.status] = parseInt(row.count, 10);
    }
  });

  return summary;
};

module.exports = {
  createShipment,
  cancelShipment,
  getShipmentSummary,
  createRtoShipment,
  createReverseShipment,
  getOrderThread,
};
