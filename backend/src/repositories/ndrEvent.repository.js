'use strict';

const { NdrEvent, NdrAction, Shipment, Order, CourierProvider, User } = require('../models');
const { Op } = require('sequelize');

const findById = async (id, tenantId) => {
  const where = { id };
  if (tenantId) where.tenant_id = tenantId;
  return NdrEvent.findOne({
    where,
    include: [
      {
        model: Shipment,
        as: 'shipment',
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
        ],
      },
      {
        model: NdrAction,
        as: 'actions',
        include: [
          {
            model: User,
            as: 'performer',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    ],
    order: [[{ model: NdrAction, as: 'actions' }, 'created_at', 'DESC']],
  });
};

const findAll = async ({
  tenant_id,
  status,
  reason_code,
  date_from,
  date_to,
  from,
  to,
  all_time,
  page = 1,
  limit = 20,
  sort = 'created_at',
  order = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const where = {};
  if (tenant_id) where.tenant_id = tenant_id;

  if (status) {
    where.status = status;
  }

  if (reason_code) {
    where.reason_code = reason_code;
  }

  const effectiveFrom = from || date_from;
  const effectiveTo = to || date_to;
  if (effectiveFrom || effectiveTo) {
    where.created_at = {};
    if (effectiveFrom) {
      where.created_at[Op.gte] = new Date(`${effectiveFrom.split('T')[0]}T00:00:00.000Z`);
    }
    if (effectiveTo) {
      where.created_at[Op.lte] = new Date(`${effectiveTo.split('T')[0]}T23:59:59.999Z`);
    }
  } else if (all_time !== true && all_time !== 'true') {
    where.created_at = {
      [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
  }

  const { count, rows } = await NdrEvent.findAndCountAll({
    where,
    limit,
    offset,
    include: [
      {
        model: Shipment,
        as: 'shipment',
        include: [
          {
            model: Order,
            as: 'order',
            attributes: ['id', 'order_reference', 'customer_name'],
          },
          {
            model: CourierProvider,
            as: 'provider',
            attributes: ['id', 'display_name', 'provider_key'],
          },
        ],
      },
    ],
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
  return NdrEvent.create(data, { transaction });
};

const update = async (id, data, transaction = null) => {
  const ndrEvent = await NdrEvent.findByPk(id, { transaction });
  if (!ndrEvent) return null;
  await ndrEvent.update(data, { transaction });
  return ndrEvent;
};

module.exports = {
  findById,
  findAll,
  create,
  update,
};
