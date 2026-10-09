'use strict';

/**
 * Base Sales Channel Adapter Interface
 * Standardizes integration methods for external ecommerce platforms (Shopify, WooCommerce, Amazon, etc.)
 */
class SalesChannelAdapterInterface {
  /**
   * Fetch orders from external store
   * @param {Object} options - { sinceDate, limit, page }
   * @returns {Promise<Array<Object>>} Standardized order payload
   */
  async fetchOrders(options = {}) {
    throw new Error('fetchOrders() must be implemented by subclass');
  }

  /**
   * Push tracking update back to external store
   * @param {string} externalOrderId - Store's order ID
   * @param {Object} trackingData - { awb, courierName, trackingUrl, status }
   * @returns {Promise<Object>} Response confirmation
   */
  async pushTrackingUpdate(externalOrderId, trackingData) {
    throw new Error('pushTrackingUpdate() must be implemented by subclass');
  }

  /**
   * Verify signature/authenticity of inbound store webhook
   * @param {Object} req - Express request object
   * @returns {boolean} True if verified
   */
  verifyWebhook(req) {
    throw new Error('verifyWebhook() must be implemented by subclass');
  }
}

module.exports = SalesChannelAdapterInterface;
