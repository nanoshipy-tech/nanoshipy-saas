const { v4: uuidv4 } = require('uuid');
const { WalletRechargeRequest } = require('../models');
const { Op } = require('sequelize');

const create = async (data) =>
  WalletRechargeRequest.create({ id: uuidv4(), ...data });

const updateByRazorpayOrderId = async (razorpayOrderId, updates, transaction) =>
  WalletRechargeRequest.update(updates, { where: { razorpay_order_id: razorpayOrderId }, transaction });

const findBySeller = async (sellerId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await WalletRechargeRequest.findAndCountAll({
    where: { seller_id: sellerId },
    order: [['initiated_at', 'DESC']],
    limit, offset,
  });
  return { total: count, page, limit, data: rows };
};

module.exports = { create, updateByRazorpayOrderId, findBySeller };
