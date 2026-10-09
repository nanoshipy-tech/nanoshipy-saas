'use strict';

const { WalletTransaction } = require('../models');
const { Op } = require('sequelize');

const findAll = async ({
  tenant_id,
  type,
  reference_type,
  date_from,
  date_to,
  page = 1,
  limit = 20,
  sort = 'created_at',
  order = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const where = { tenant_id };

  if (type) {
    where.type = type;
  }

  if (reference_type) {
    where.reference_type = reference_type;
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      where.created_at[Op.lte] = new Date(date_to);
    }
  }

  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    limit,
    offset,
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

module.exports = {
  findAll,
};
