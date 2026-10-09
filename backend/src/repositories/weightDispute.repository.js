'use strict';

const { WeightDiscrepancyDispute, Shipment } = require('../models');

class WeightDisputeRepository {
  async create(data, transaction) {
    return WeightDiscrepancyDispute.create(data, { transaction });
  }

  async findById(id, sellerId = null) {
    const where = { id };
    if (sellerId) where.seller_id = sellerId;
    return WeightDiscrepancyDispute.findOne({
      where,
      include: [{ model: Shipment, as: 'shipment' }],
    });
  }

  async findByShipmentId(shipmentId) {
    return WeightDiscrepancyDispute.findOne({ where: { shipment_id: shipmentId } });
  }

  async list(options = {}) {
    return WeightDiscrepancyDispute.findAndCountAll({
      order: [['created_at', 'DESC']],
      include: [{ model: Shipment, as: 'shipment' }],
      ...options,
    });
  }

  async update(id, updates, transaction) {
    const dispute = await WeightDiscrepancyDispute.findByPk(id);
    if (!dispute) return null;
    return dispute.update(updates, { transaction });
  }
}

module.exports = new WeightDisputeRepository();
