'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const PaymentGatewayAdapter = require('../base/PaymentGatewayAdapter.interface');
const logger = require('../../utils/logger');

class RazorpayAdapter extends PaymentGatewayAdapter {
  constructor(config) {
    super(config);
    this.keyId = config.keyId || process.env.RAZORPAY_KEY_ID;
    this.keySecret = config.keySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!this.keyId || !this.keySecret) {
      logger.warn('[RazorpayAdapter] Razorpay keys not initialized in environmental variables.');
    }

    this.client = new Razorpay({
      key_id: this.keyId || 'dummy_key',
      key_secret: this.keySecret || 'dummy_secret',
    });
  }

  /**
   * Create an order in Razorpay
   */
  async createOrder({ amount, currency = 'INR', receiptId }) {
    try {
      // Razorpay expects amount in paise (1 INR = 100 paise)
      const amountInPaise = Math.round(parseFloat(amount) * 100);

      const rzpOrder = await this.client.orders.create({
        amount: amountInPaise,
        currency,
        receipt: receiptId,
      });

      return {
        gatewayOrderId: rzpOrder.id,
        amount: parseFloat(rzpOrder.amount) / 100,
        currency: rzpOrder.currency,
      };
    } catch (err) {
      logger.error(`[RazorpayAdapter] Create order error: ${err.message}`);
      throw new Error(`Razorpay gateway order creation failed: ${err.message}`);
    }
  }

  /**
   * Verify signature (HMAC-SHA256)
   */
  async verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
    try {
      if (!this.keySecret) {
        throw new Error('Razorpay key secret not configured');
      }

      const body = gatewayOrderId + '|' + gatewayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      return expectedSignature === gatewaySignature;
    } catch (err) {
      logger.error(`[RazorpayAdapter] Signature verification threw: ${err.message}`);
      return false;
    }
  }

  /**
   * Verify server-to-server webhook payload signature
   */
  verifyWebhookSignature(payload, signature, webhookSecret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return expectedSignature === signature;
    } catch (err) {
      logger.error(`[RazorpayAdapter] Webhook signature verification error: ${err.message}`);
      return false;
    }
  }
}

module.exports = RazorpayAdapter;
