const { v4: uuidv4 } = require('uuid');
const { StorefrontConnection } = require('../models');

const create = async (data) => StorefrontConnection.create({ id: uuidv4(), ...data });
const findBySeller = async (sellerId) =>
  StorefrontConnection.findAll({
    where: { seller_id: sellerId },
    order: [['updated_at', 'DESC']],
  });
const findOneBySellerAndPlatform = async (sellerId, platform) =>
  StorefrontConnection.findOne({
    where: { seller_id: sellerId, platform },
    order: [['updated_at', 'DESC']],
  });
const findById = async (id) => StorefrontConnection.findByPk(id);
const update = async (id, data) => {
  await StorefrontConnection.update(data, { where: { id } });
  return findById(id);
};

module.exports = { create, findBySeller, findOneBySellerAndPlatform, findById, update };

