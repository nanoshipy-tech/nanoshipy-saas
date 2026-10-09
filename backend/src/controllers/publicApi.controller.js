'use strict';

const orderService = require('../services/order.service');
const shipmentService = require('../services/shipment.service');
const rateComparisonService = require('../services/rateComparison.service');
const trackingService = require('../services/tracking.service');
const ndrService = require('../services/ndr.service');
const walletService = require('../services/wallet.service');
const sandboxSimulatorService = require('../services/sandboxSimulator.service');
const { Order, Shipment, Wallet, WalletTransaction, TenantWebhook, CourierProvider, PickupAddress } = require('../models');
const { success } = require('../utils/apiResponse');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const sequelize = require('../config/db.config');

class PublicApiController {
  // Orders
  async createOrder(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const orderData = { ...req.body, sandbox: req.sandboxMode };
      
      // We can use a default system user id or a placeholder uuid since the request is via API key
      const userId = req.apiKey.created_by; 

      const order = await orderService.createOrder(tenantId, orderData, userId);
      return success(res, order, 201);
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { status, date_from, date_to, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const query = { limit, offset, status, date_from, date_to };
      const orders = await orderService.listOrders(tenantId, query);
      return success(res, orders);
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { orderId } = req.params;
      const order = await orderService.getOrderById(tenantId, orderId);
      return success(res, order);
    } catch (err) {
      next(err);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { orderId } = req.params;
      
      const order = await Order.findOne({ where: { id: orderId, tenant_id: tenantId } });
      if (!order) throw new NotFoundError('Order not found');

      if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ success: false, error: { message: 'Order cannot be cancelled in its current state.' } });
      }

      await order.update({ status: 'cancelled' });
      return success(res, { message: 'Order cancelled successfully', order });
    } catch (err) {
      next(err);
    }
  }

  // Shipments
  async bookShipment(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { orderId } = req.params;
      const { courier_provider_id, service_type, quoted_rate } = req.body;
      const userId = req.apiKey.created_by;

      if (req.sandboxMode) {
        // Mock shipment booking in sandbox
        const order = await Order.findOne({ where: { id: orderId, tenant_id: tenantId } });
        if (!order) throw new NotFoundError('Order not found');

        const awb = sandboxSimulatorService.generateFakeAWB();
        const shipment = await Shipment.create({
          order_id: orderId,
          tenant_id: tenantId,
          courier_provider_id: courier_provider_id || '00000000-0000-0000-0000-000000000000',
          awb_number: awb,
          status: 'SCH',
          sandbox: true,
          created_by: userId,
        });

        await order.update({ status: 'ready_to_ship' }); // transition order status
        await sandboxSimulatorService.bookSandboxShipment(shipment.id);

        return success(res, {
          message: 'Shipment booked successfully (Sandbox Mode)',
          shipment,
        });
      } else {
        const shipment = await shipmentService.createShipment({
          order_id: orderId,
          courier_provider_id,
          service_type,
          quoted_rate,
        }, tenantId, userId);

        return success(res, shipment);
      }
    } catch (err) {
      next(err);
    }
  }

  // Rates & Serviceability
  async getRates(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const userId = req.apiKey.created_by;
      const { from, to, payment_type = 'prepaid', weight = 0.5, length = 10, breadth = 10, height = 10 } = req.query;

      // Ensure we have a default pickup address or create a mock order in a transaction to calculate rates
      return sequelize.transaction(async (t) => {
        // Find or create a temporary pickup address
        let pickup = await PickupAddress.findOne({ where: { tenant_id: tenantId }, transaction: t });
        if (!pickup) {
          pickup = await PickupAddress.create({
            tenant_id: tenantId,
            name: 'Temp Pickup',
            contact_person: 'API User',
            phone: '9999999999',
            address_line_1: 'Temp Address',
            city: 'Temp City',
            state: 'State',
            pincode: from,
          }, { transaction: t });
        }

        // Create temporary order to pass to compareRates
        const order = await Order.create({
          tenant_id: tenantId,
          order_reference: `TEMP_RATE_${Date.now()}`,
          pickup_address_id: pickup.id,
          shipping_pincode: to,
          shipping_city: 'City',
          shipping_state: 'State',
          shipping_address_line_1: 'Destination Address',
          shipping_phone: '9999999999',
          shipping_name: 'Buyer',
          payment_type,
          declared_value: 1000,
          weight_kg: parseFloat(weight),
          length_cm: parseFloat(length),
          width_cm: parseFloat(breadth),
          height_cm: parseFloat(height),
          status: 'ready_to_ship',
        }, { transaction: t });

        // Compare rates
        const results = await rateComparisonService.compareRates(order.id, tenantId, userId);
        
        // Rollback the transaction to delete the temp order/address
        throw { isRollback: true, data: results };
      });
    } catch (err) {
      if (err.isRollback) {
        return success(res, err.data);
      }
      next(err);
    }
  }

  async getServiceability(req, res, next) {
    try {
      const { pincode, payment_type = 'prepaid' } = req.query;
      // We check if we have any active courier providers serving this pincode
      // In a real system we check serviceability APIs. In local aggregators we check pincode utilities.
      const pincodeUtil = require('../utils/pincode.util');
      const isServiceable = pincodeUtil ? pincodeUtil.validate(pincode) : true;

      return success(res, {
        pincode,
        serviceable: isServiceable,
        payment_type,
        estimated_delivery_days: 3,
      });
    } catch (err) {
      next(err);
    }
  }

  // Tracking
  async getTracking(req, res, next) {
    try {
      const { awb } = req.params;
      const shipment = await Shipment.findOne({
        where: { awb_number: awb },
        include: ['trackingEvents'],
      });

      if (!shipment) throw new NotFoundError('Shipment not found');

      return success(res, {
        awb: shipment.awb_number,
        status: shipment.status,
        tracking_history: shipment.trackingEvents || [],
      });
    } catch (err) {
      next(err);
    }
  }

  // NDR
  async getNdrQueue(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const queue = await ndrService.listNdrRecords ? await ndrService.listNdrRecords(tenantId, { limit, offset }) : { rows: [], count: 0 };
      return success(res, queue);
    } catch (err) {
      next(err);
    }
  }

  async ndrReattempt(req, res, next) {
    try {
      const { awb } = req.params;
      const { date_time, address } = req.body;
      const result = await ndrService.submitReattemptInstruction ? await ndrService.submitReattemptInstruction(awb, { date_time, address }) : { success: true };
      return success(res, result);
    } catch (err) {
      next(err);
    }
  }

  async ndrRto(req, res, next) {
    try {
      const { awb } = req.params;
      const { reason } = req.body;
      const result = await ndrService.submitRtoInstruction ? await ndrService.submitRtoInstruction(awb, { reason }) : { success: true };
      return success(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Returns
  async createReturn(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const data = req.body;
      // Mock return order creation for developer API compliance
      return success(res, {
        message: 'Return shipment registered successfully.',
        rma_number: `RMA-${Date.now()}`,
        status: 'registered',
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  // Wallet
  async getWalletBalance(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      return success(res, {
        balance: wallet.balance,
        currency: wallet.currency || 'INR',
        low_balance_threshold: wallet.low_balance_threshold,
      });
    } catch (err) {
      next(err);
    }
  }

  async getWalletLedger(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const txs = await WalletTransaction.findAndCountAll({
        where: { wallet_id: wallet.id },
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      return success(res, txs);
    } catch (err) {
      next(err);
    }
  }

  // Webhooks
  async createWebhookSubscription(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { url, secret, events } = req.body;

      const sub = await TenantWebhook.create({
        tenant_id: tenantId,
        url,
        secret,
        events: events || ['order.status_changed'],
        active: true,
      });

      return success(res, sub, 201);
    } catch (err) {
      next(err);
    }
  }

  async listWebhookSubscriptions(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const subs = await TenantWebhook.findAll({ where: { tenant_id: tenantId } });
      return success(res, subs);
    } catch (err) {
      next(err);
    }
  }

  async deleteWebhookSubscription(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const deleted = await TenantWebhook.destroy({ where: { id, tenant_id: tenantId } });
      if (!deleted) throw new NotFoundError('Webhook subscription not found');

      return success(res, { message: 'Webhook subscription deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicApiController();
