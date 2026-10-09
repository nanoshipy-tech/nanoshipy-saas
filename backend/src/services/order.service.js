const orderRepository = require('../repositories/order.repository');
const orderStatusService = require('./orderStatus.service');
const { sequelize } = require('../models');
const auditService = require('./audit.service');
const { NotFoundError } = require('../utils/errors');

class DuplicateOrderReferenceError extends Error {
  constructor(ref) {
    super(`An order with reference "${ref}" already exists`);
    this.name = 'DuplicateOrderReferenceError';
    this.code = 'DUPLICATE_ORDER_REFERENCE';
    this.status = 409;
  }
}

class OrderNotEditableError extends Error {
  constructor(status) {
    super(`Orders in "${status}" status are not editable`);
    this.name = 'OrderNotEditableError';
    this.code = 'ORDER_NOT_EDITABLE';
    this.status = 409;
  }
}

class OrderService {
  onOrderCreated(order) {
    const eventBus = require('../events/eventBus');
    eventBus.emit('order.created', order);
  }

  onOrderStatusChanged(order, oldStatus, newStatus) {
    const eventBus = require('../events/eventBus');
    eventBus.emit('order.status_changed', {
      order,
      order_reference: order.order_reference,
      status: newStatus,
      oldStatus,
      tenant_id: order.tenant_id,
    });
  }

  async getOrderById(tenantId, id) {
    const order = await orderRepository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  async listOrders(tenantId, query) {
    return orderRepository.findAndCountAll(tenantId, query);
  }

  async getOrderSummary(tenantId) {
    const { Order } = require('../models');
    const whereClause = (status) => {
      const w = { status };
      if (tenantId) w.tenant_id = tenantId;
      return w;
    };
    const pending = await Order.count({ where: whereClause('pending') });
    const processing = await Order.count({ where: whereClause('processing') });
    const ready_to_ship = await Order.count({ where: whereClause('ready_to_ship') });
    const cancelled = await Order.count({ where: whereClause('cancelled') });
    return { pending, processing, ready_to_ship, cancelled };
  }

  async createOrder(tenantId, data, userId) {
    const duplicate = await orderRepository.checkDuplicate(tenantId, data.order_reference);
    if (duplicate) {
      throw new DuplicateOrderReferenceError(data.order_reference);
    }

    const { items, ...orderData } = data;
    
    // Auto-calculate order_value from items if not provided
    if (orderData.order_value === undefined) {
      orderData.order_value = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    }

    // COD check: If payment_mode is COD, cod_amount should be set
    if (orderData.payment_mode === 'cod' && orderData.cod_amount === undefined) {
      orderData.cod_amount = orderData.order_value;
    }

    const order = await orderRepository.create(tenantId, orderData, items, userId);

    await auditService.log({
      action: 'order_created',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'order',
      entity_id: order.id,
      metadata: { order_reference: order.order_reference }
    });

    this.onOrderCreated(order);

    return order;
  }

  async updateOrder(tenantId, id, data, userId) {
    const order = await this.getOrderById(tenantId, id);

    // Guard: Editable window check (only pending and processing are editable)
    if (!['pending', 'processing'].includes(order.status)) {
      throw new OrderNotEditableError(order.status);
    }

    const { items, ...orderData } = data;

    // Check duplicate reference if changing it
    if (orderData.order_reference && orderData.order_reference !== order.order_reference) {
      const duplicate = await orderRepository.checkDuplicate(tenantId, orderData.order_reference);
      if (duplicate) {
        throw new DuplicateOrderReferenceError(orderData.order_reference);
      }
    }

    // Re-calculate order value if items are updated
    if (items) {
      orderData.order_value = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      if (order.payment_mode === 'cod' && orderData.cod_amount === undefined) {
        orderData.cod_amount = orderData.order_value;
      }
    }

    const updated = await orderRepository.update(tenantId, id, orderData, items, userId);

    await auditService.log({
      action: 'order_updated',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'order',
      entity_id: id,
      metadata: { changed: Object.keys(orderData) }
    });

    return updated;
  }

  async changeStatus(tenantId, id, newStatus, userId, note = null) {
    const order = await this.getOrderById(tenantId, id);
    const oldStatus = order.status;

    orderStatusService.validateTransition(oldStatus, newStatus);

    await sequelize.transaction(async (t) => {
      await order.update({ status: newStatus }, { transaction: t });
      await orderStatusService.logHistory(order.id, oldStatus, newStatus, userId, note, t);
    });

    await auditService.log({
      action: 'order_status_changed',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'order',
      entity_id: id,
      metadata: { old_status: oldStatus, new_status: newStatus, note }
    });

    this.onOrderStatusChanged(order, oldStatus, newStatus);

    return order;
  }

  async cancelOrder(tenantId, id, userId, note = null) {
    const order = await this.getOrderById(tenantId, id);

    if (order.status === 'cancelled') {
      return order;
    }

    if (['delivered', 'rto_delivered', 'lost', 'damaged'].includes(order.status)) {
      throw new OrderNotEditableError(`Order in status "${order.status}" cannot be cancelled`);
    }

    const { Shipment } = require('../models');
    const { Op } = require('sequelize');

    // Check if there is an active shipment for this order
    const activeShipment = await Shipment.findOne({
      where: {
        order_id: order.id,
        tenant_id: tenantId,
        status: { [Op.notIn]: ['cancelled', 'failed'] },
      },
    });

    if (activeShipment) {
      // Route through single source of truth: shipmentService.cancelShipment
      const shipmentService = require('./shipment.service');
      await shipmentService.cancelShipment(activeShipment.id, tenantId, userId);
    }

    const oldStatus = order.status;

    await sequelize.transaction(async (t) => {
      await order.update({ status: 'cancelled' }, { transaction: t });
      await orderStatusService.logHistory(order.id, oldStatus, 'cancelled', userId, note || 'Order cancelled by user', t);
    });

    await auditService.log({
      action: 'order_cancelled',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'order',
      entity_id: id,
      metadata: { note, had_active_shipment: Boolean(activeShipment) }
    });

    this.onOrderStatusChanged(order, oldStatus, 'cancelled');

    return order;
  }

  async getSummary(tenantId) {
    return orderRepository.getSummary(tenantId);
  }
}

module.exports = new OrderService();
module.exports.DuplicateOrderReferenceError = DuplicateOrderReferenceError;
module.exports.OrderNotEditableError = OrderNotEditableError;
