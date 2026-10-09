const { Order, OrderItem, OrderStatusHistory, PickupAddress, Shipment, Tenant, sequelize } = require('../models');
const { Op } = require('sequelize');

const checkDuplicate = async (tenantId, orderReference, transaction = null) => {
  return Order.findOne({
    where: { tenant_id: tenantId, order_reference: orderReference },
    transaction,
  });
};

const findById = async (tenantId, id, transaction = null) => {
  const where = { id };
  if (tenantId) where.tenant_id = tenantId;
  return Order.findOne({
    where,
    include: [
      { model: OrderItem, as: 'items' },
      { model: PickupAddress, as: 'pickupAddress' },
      { model: OrderStatusHistory, as: 'statusHistory' },
      { model: Shipment, as: 'shipments', required: false },
      { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'subdomain'], required: false },
    ],
    order: [
      [{ model: OrderStatusHistory, as: 'statusHistory' }, 'created_at', 'ASC'],
    ],
    transaction,
  });
};

const create = async (tenantId, orderData, itemDataList, userId, transaction = null) => {
  const localTx = transaction || await sequelize.transaction();
  try {
    const order = await Order.create({
      ...orderData,
      tenant_id: tenantId,
      created_by: userId,
      status: 'pending',
    }, { transaction: localTx });

    const items = itemDataList.map(item => ({
      ...item,
      order_id: order.id,
    }));

    await OrderItem.bulkCreate(items, { transaction: localTx });

    // Initial status log
    await OrderStatusHistory.create({
      order_id: order.id,
      old_status: null,
      new_status: 'pending',
      changed_by: userId,
      note: 'Order created',
    }, { transaction: localTx });

    if (!transaction) await localTx.commit();

    return order;
  } catch (err) {
    if (!transaction) await localTx.rollback();
    throw err;
  }
};

const update = async (tenantId, id, orderData, itemDataList, userId, transaction = null) => {
  const localTx = transaction || await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id, tenant_id: tenantId },
      transaction: localTx,
    });

    if (!order) throw new Error('Order not found');

    await order.update(orderData, { transaction: localTx });

    if (itemDataList) {
      // Remove old items
      await OrderItem.destroy({
        where: { order_id: id },
        transaction: localTx,
      });

      // Insert new items
      const items = itemDataList.map(item => ({
        ...item,
        order_id: id,
      }));
      await OrderItem.bulkCreate(items, { transaction: localTx });
    }

    if (!transaction) await localTx.commit();
    return order;
  } catch (err) {
    if (!transaction) await localTx.rollback();
    throw err;
  }
};

const findAndCountAll = async (tenantId, queryOptions) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    payment_mode,
    pickup_address_id,
    date_from,
    date_to,
    from,
    to,
    all_time,
    source,
    tenant_id,
    sort = 'created_at:desc',
  } = queryOptions;

  const offset = (page - 1) * limit;
  const whereClause = {};
  const effectiveTenantId = tenantId || tenant_id || null;
  if (effectiveTenantId) whereClause.tenant_id = effectiveTenantId;

  if (status) whereClause.status = status;
  if (payment_mode) whereClause.payment_mode = payment_mode;
  if (pickup_address_id) whereClause.pickup_address_id = pickup_address_id;
  if (source) whereClause.source = source;

  const effectiveFrom = from || date_from;
  const effectiveTo = to || date_to;
  if (effectiveFrom || effectiveTo) {
    whereClause.created_at = {};
    if (effectiveFrom) whereClause.created_at[Op.gte] = new Date(`${effectiveFrom.split('T')[0]}T00:00:00.000Z`);
    if (effectiveTo) whereClause.created_at[Op.lte] = new Date(`${effectiveTo.split('T')[0]}T23:59:59.999Z`);
  } else if (all_time !== true && all_time !== 'true') {
    whereClause.created_at = {
      [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
  }

  const likeOperator = Op.iLike && process.env.USE_SQLITE !== 'true' ? Op.iLike : Op.like;
  if (search) {
    whereClause[Op.or] = [
      { order_reference: { [likeOperator]: `%${search}%` } },
      { customer_name: { [likeOperator]: `%${search}%` } },
      { customer_phone: { [likeOperator]: `%${search}%` } },
    ];
  }

  const [sortField, sortOrder] = sort.split(':');
  const order = [[sortField || 'created_at', (sortOrder || 'DESC').toUpperCase()]];

  const { rows, count } = await Order.findAndCountAll({
    where: whereClause,
    include: [
      { model: OrderItem, as: 'items' },
      { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'subdomain'], required: false },
    ],
    distinct: true, // required to get correct count when including hasMany association
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    order,
  });

  return {
    items: rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: count,
      total_pages: Math.ceil(count / limit),
    }
  };
};

const getSummary = async (tenantId) => {
  const counts = await Order.findAll({
    where: { tenant_id: tenantId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true,
  });

  const summary = {
    pending: 0,
    processing: 0,
    ready_to_ship: 0,
    cancelled: 0,
  };

  counts.forEach(row => {
    if (summary[row.status] !== undefined) {
      summary[row.status] = parseInt(row.count, 10);
    }
  });

  return summary;
};

module.exports = {
  checkDuplicate,
  findById,
  create,
  update,
  findAndCountAll,
  getSummary,
};
