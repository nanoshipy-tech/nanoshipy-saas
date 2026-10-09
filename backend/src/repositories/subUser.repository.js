'use strict';

const { SubUser } = require('../models');

class SubUserRepository {
  async create(data, transaction) {
    return SubUser.create(data, { transaction });
  }

  async findById(id, sellerId = null) {
    const where = { id };
    if (sellerId) where.seller_id = sellerId;
    return SubUser.findOne({ where });
  }

  async findByEmail(email) {
    return SubUser.findOne({ where: { email } });
  }

  async findByInviteTokenHash(tokenHash) {
    return SubUser.findOne({ where: { invite_token_hash: tokenHash } });
  }

  async list(sellerId, options = {}) {
    return SubUser.findAndCountAll({
      where: { seller_id: sellerId },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async update(id, sellerId, updates, transaction) {
    const subUser = await SubUser.findOne({ where: { id, seller_id: sellerId } });
    if (!subUser) return null;
    return subUser.update(updates, { transaction });
  }
}

module.exports = new SubUserRepository();
