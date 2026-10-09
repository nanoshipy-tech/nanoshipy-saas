'use strict';

const { Wallet } = require('../models');

const findByTenantId = async (tenantId, transaction = null) => {
  return Wallet.findOne({
    where: { tenant_id: tenantId },
    transaction,
  });
};

const create = async (data, transaction = null) => {
  return Wallet.create(data, { transaction });
};

const update = async (id, data, transaction = null) => {
  const wallet = await Wallet.findByPk(id, { transaction });
  if (!wallet) return null;
  await wallet.update(data, { transaction });
  return wallet;
};

module.exports = {
  findByTenantId,
  create,
  update,
};
