const { OrderImport } = require('../models');

const create = async (importData, transaction = null) => {
  return OrderImport.create(importData, { transaction });
};

const findById = async (tenantId, id, transaction = null) => {
  return OrderImport.findOne({
    where: { id, tenant_id: tenantId },
    transaction,
  });
};

const update = async (id, updateData, transaction = null) => {
  const record = await OrderImport.findByPk(id, { transaction });
  if (!record) throw new Error('Import record not found');
  return record.update(updateData, { transaction });
};

const findAllByTenant = async (tenantId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await OrderImport.findAndCountAll({
    where: { tenant_id: tenantId },
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    order: [['created_at', 'DESC']],
  });

  return {
    items: rows,
    rows: rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: count,
      total_pages: Math.ceil(count / limit),
    }
  };
};

module.exports = {
  create,
  findById,
  update,
  findAllByTenant,
};
