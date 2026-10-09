'use strict';

/**
 * PaymentGatewayAdapter
 *
 * @interface
 * @description Core architectural contract that all payment gateway adapters MUST implement.
 */
class PaymentGatewayAdapter {
  constructor(config) {
    if (this.constructor === PaymentGatewayAdapter) {
      throw new Error("PaymentGatewayAdapter is an abstract interface and cannot be instantiated directly.");
    }
    this.config = config;
  }

  /**
   * Create a transaction/recharge order in the payment gateway's systems.
   *
   * @param {object} params
   * @param {number} params.amount - positive amount (e.g. 500.00)
   * @param {string} params.currency - 'INR'
   * @param {string} params.receiptId - unique transaction code
   * @returns {Promise<object>} resolving to standard data: { gatewayOrderId, amount, currency }
   */
  async createOrder({ amount, currency, receiptId }) {
    throw new Error('Method "createOrder" must be implemented by payment adapter');
  }

  /**
   * Validate payment gateway signature (prevents client-side spoofing).
   *
   * @param {object} params
   * @param {string} params.gatewayOrderId
   * @param {string} params.gatewayPaymentId
   * @param {string} params.gatewaySignature
   * @returns {Promise<boolean>}
   */
  async verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
    throw new Error('Method "verifyPaymentSignature" must be implemented by payment adapter');
  }
}

module.exports = PaymentGatewayAdapter;
