/**
 * razorpay.service.js — Razorpay SDK wrapper
 * Zero external dependencies at module load time; lazily initialises Razorpay
 * so the server starts even when keys are not yet set.
 */
const crypto = require('crypto');

let _rzp = null;
const getRzp = () => {
  if (_rzp) return _rzp;
  const Razorpay = require('razorpay');
  _rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return _rzp;
};

/**
 * Create a Razorpay Order.
 * @param {object} params
 * @param {number} params.amountPaise  - amount in paise (₹1 = 100)
 * @param {string} params.currency     - 'INR'
 * @param {string} params.receipt      - unique receipt ref
 * @param {object} params.notes        - key-value metadata
 */
const createOrder = async ({ amountPaise, currency = 'INR', receipt, notes = {} }) => {
  const order = await getRzp().orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
  });
  return order;
};

/**
 * Verify Razorpay payment signature.
 * Signature = HMAC-SHA256(orderId + '|' + paymentId, keySecret)
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }
  try {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

/**
 * Verify Razorpay webhook signature.
 * X-Razorpay-Signature = HMAC-SHA256(rawBody, webhookSecret)
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }
  try {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

/** Fetch a payment object from Razorpay */
const fetchPayment = async (paymentId) => getRzp().payments.fetch(paymentId);

/** Create a refund for a payment */
const createRefund = async (paymentId, amountPaise) =>
  getRzp().payments.refund(paymentId, { amount: amountPaise });

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature, fetchPayment, createRefund };
