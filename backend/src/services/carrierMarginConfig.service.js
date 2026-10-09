'use strict';

const carrierMarginConfigRepository = require('../repositories/carrierMarginConfig.repository');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

class CarrierMarginConfigService {
  async createConfig(adminId, data) {
    const { carrier_id, seller_id, seller_tier, margin_type, margin_value, effective_from, effective_until } = data;

    if (!['flat', 'percentage'].includes(margin_type)) {
      throw new BadRequestError('margin_type must be "flat" or "percentage".');
    }

    return carrierMarginConfigRepository.create({
      carrier_id,
      seller_id: seller_id || null,
      seller_tier: seller_tier || 'all',
      margin_type,
      margin_value: parseFloat(margin_value),
      effective_from: effective_from || new Date(),
      effective_until: effective_until || null,
      created_by: adminId,
    });
  }

  async updateConfig(id, data) {
    const config = await carrierMarginConfigRepository.findById(id);
    if (!config) throw new NotFoundError('Carrier margin config not found.');
    return carrierMarginConfigRepository.update(id, data);
  }

  async listConfigs(options = {}) {
    return carrierMarginConfigRepository.list(options);
  }

  async getConfig(id) {
    const config = await carrierMarginConfigRepository.findById(id);
    if (!config) throw new NotFoundError('Carrier margin config not found.');
    return config;
  }

  /**
   * Resolve the applicable margin for a carrier + seller combination.
   * Called by the rate engine during rate comparison.
   * @returns { margin_type, margin_value } or null if no config applies
   */
  async resolveMargin(carrierId, sellerId, sellerTier = 'standard') {
    const today = new Date().toISOString().split('T')[0];
    const config = await carrierMarginConfigRepository.resolveMargin(carrierId, sellerId, sellerTier, today);

    if (!config) {
      logger.debug(`[CarrierMarginConfigService] No margin config found for carrier ${carrierId}, seller ${sellerId}`);
      return null;
    }

    logger.debug(`[CarrierMarginConfigService] Resolved margin for carrier ${carrierId}: ${config.margin_type} ${config.margin_value}`);
    return {
      margin_type: config.margin_type,
      margin_value: parseFloat(config.margin_value),
    };
  }

  /**
   * Apply margin on top of base rate. Called by rateComparison.service.
   * @param {number} baseRate
   * @param {{ margin_type: string, margin_value: number }} margin
   * @returns {number} effective rate after margin
   */
  applyMargin(baseRate, margin) {
    if (!margin) return baseRate;
    if (margin.margin_type === 'flat') return baseRate + margin.margin_value;
    if (margin.margin_type === 'percentage') return baseRate * (1 + margin.margin_value / 100);
    return baseRate;
  }
}

module.exports = new CarrierMarginConfigService();
