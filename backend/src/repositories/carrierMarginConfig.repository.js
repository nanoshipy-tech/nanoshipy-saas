'use strict';

const { CarrierMarginConfig, CourierProvider, Tenant } = require('../models');
const { Op } = require('sequelize');

class CarrierMarginConfigRepository {
  async create(data, transaction) {
    return CarrierMarginConfig.create(data, { transaction });
  }

  async findById(id) {
    return CarrierMarginConfig.findByPk(id, {
      include: [
        { model: CourierProvider, as: 'carrier', attributes: ['id', 'provider_key', 'display_name'] },
        { model: Tenant, as: 'seller', attributes: ['id', 'company_name', 'subdomain'] },
      ],
    });
  }

  async list(options = {}) {
    return CarrierMarginConfig.findAndCountAll({
      order: [['created_at', 'DESC']],
      include: [
        { model: CourierProvider, as: 'carrier', attributes: ['id', 'provider_key', 'display_name'] },
        { model: Tenant, as: 'seller', attributes: ['id', 'company_name', 'subdomain'] },
      ],
      ...options,
    });
  }

  async update(id, updates, transaction) {
    const config = await CarrierMarginConfig.findByPk(id);
    if (!config) return null;
    return config.update(updates, { transaction });
  }

  async resolveMargin(carrierId, sellerId, tier, dateStr) {
    // Resolve margins hierarchically:
    // 1. Seller specific config
    // 2. Seller tier specific config
    // 3. All tier (platform default) config
    // We check effective dates.
    const configs = await CarrierMarginConfig.findAll({
      where: {
        carrier_id: carrierId,
        effective_from: { [Op.lte]: dateStr },
        [Op.or]: [
          { effective_until: null },
          { effective_until: { [Op.gte]: dateStr } },
        ],
      },
      order: [
        // Prioritize: specific seller, then tier-specific, then 'all'
        [sequelize.literal(`CASE WHEN seller_id = '${sellerId}' THEN 1 WHEN seller_tier = '${tier}' THEN 2 WHEN seller_tier = 'all' THEN 3 ELSE 4 END`), 'ASC'],
        ['created_at', 'DESC'],
      ],
    });

    return configs[0] || null;
  }
}

module.exports = new CarrierMarginConfigRepository();
const sequelize = require('../config/db.config');
