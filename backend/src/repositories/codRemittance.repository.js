'use strict';

const { CodRemittance } = require('../models');

class CodRemittanceRepository {
  async create(data, transaction) {
    return CodRemittance.create(data, { transaction });
  }

  async findById(id, sellerId = null) {
    const where = { id };
    if (sellerId) where.seller_id = sellerId;
    return CodRemittance.findOne({ where });
  }

  async list(options = {}) {
    return CodRemittance.findAndCountAll({
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async update(id, updates, transaction) {
    const record = await CodRemittance.findByPk(id);
    if (!record) return null;
    return record.update(updates, { transaction });
  }
}

module.exports = new CodRemittanceRepository();
