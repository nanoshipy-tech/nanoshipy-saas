'use strict';

const { Invoice, InvoiceLineItem, Tenant } = require('../models');
const { Op } = require('sequelize');

const findById = async (id, tenantId = null) => {
  const where = { id };
  if (tenantId) where.tenant_id = tenantId;

  return Invoice.findOne({
    where,
    include: [
      { model: InvoiceLineItem, as: 'lineItems' },
      { model: Tenant, as: 'tenant' },
    ],
  });
};

const findAll = async ({
  tenant_id,
  invoice_type,
  status,
  date_from,
  date_to,
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

  if (invoice_type) {
    where.invoice_type = invoice_type;
  }

  if (status) {
    where.status = status;
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

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    limit,
    offset,
    order: [[sort, order]],
    include: [
      { model: InvoiceLineItem, as: 'lineItems' },
      { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'subdomain'] },
    ],
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
  findById,
  findAll,
};
