'use strict';

const { Shipment, Order, CourierProvider, PickupAddress, ShipmentStatusHistory } = require('../models');
const { Op } = require('sequelize');

const findById = async (id, tenantId) => {
  const where = { id };
  if (tenantId) where.tenant_id = tenantId;
  return Shipment.scope('detailed').findOne({
    where,
    include: [
      {
        model: Order,
        as: 'order',
        attributes: [
          'id',
          'order_reference',
          'customer_name',
          'customer_phone',
          'customer_email',
          'shipping_address_line1',
          'shipping_address_line2',
          'shipping_city',
          'shipping_state',
          'shipping_pincode',
          'shipping_country',
          'order_value',
          'payment_mode',
          'cod_amount',
        ],
      },
      {
        model: CourierProvider,
        as: 'provider',
        attributes: ['id', 'provider_key', 'display_name', 'logo_url'],
      },
      {
        model: PickupAddress,
        as: 'pickupAddress',
        attributes: ['id', 'label', 'contact_name', 'contact_phone', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country', 'is_default', 'is_active'],
      },
      {
        model: ShipmentStatusHistory,
        as: 'statusHistory',
        attributes: ['id', 'shipment_id', 'old_status', 'new_status', 'source', 'note', 'created_at'],
      },
    ],
    order: [[{ model: ShipmentStatusHistory, as: 'statusHistory' }, 'created_at', 'DESC']],
  });
};

const findAll = async ({
  tenant_id,
  status,
  courier_provider_id,
  awb_number,
  date_from,
  date_to,
  from,
  to,
  all_time,
  search,
  page = 1,
  limit = 20,
  sort = 'created_at',
  order = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const where = {};
  if (tenant_id) {
    where.tenant_id = tenant_id;
  }

  if (status) {
    where.status = status;
  }

  if (courier_provider_id) {
    where.courier_provider_id = courier_provider_id;
  }

  const likeOperator = Op.iLike && process.env.USE_SQLITE !== 'true' ? Op.iLike : Op.like;

  if (awb_number) {
    where.awb_number = {
      [likeOperator]: `%${awb_number}%`,
    };
  }

  const effectiveFrom = from || date_from;
  const effectiveTo = to || date_to;
  if (effectiveFrom || effectiveTo) {
    where.created_at = {};
    if (effectiveFrom) where.created_at[Op.gte] = new Date(`${effectiveFrom.split('T')[0]}T00:00:00.000Z`);
    if (effectiveTo) where.created_at[Op.lte] = new Date(`${effectiveTo.split('T')[0]}T23:59:59.999Z`);
  } else if (all_time !== true && all_time !== 'true') {
    where.created_at = {
      [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
  }

  const orderInclude = [];
  if (search) {
    orderInclude.push({
      model: Order,
      as: 'order',
      where: {
        [Op.or]: [
          { order_reference: { [likeOperator]: `%${search}%` } },
          { customer_name: { [likeOperator]: `%${search}%` } },
        ],
      },
    });
  } else {
    orderInclude.push({
      model: Order,
      as: 'order',
      attributes: ['id', 'order_reference', 'customer_name'],
    });
  }

  // Include CourierProvider for display
  orderInclude.push({
    model: CourierProvider,
    as: 'provider',
    attributes: ['display_name', 'provider_key'],
  });

  const { count, rows } = await Shipment.findAndCountAll({
    where,
    limit,
    offset,
    include: orderInclude,
    order: [[sort, order]],
  });

  return {
    rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const create = async (data, transaction = null) => {
  return Shipment.create(data, { transaction });
};

const update = async (id, data, transaction = null) => {
  const shipment = await Shipment.findByPk(id, { transaction });
  if (!shipment) return null;
  await shipment.update(data, { transaction });
  return shipment;
};

module.exports = {
  findById,
  findAll,
  create,
  update,
};
