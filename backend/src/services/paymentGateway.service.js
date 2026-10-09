'use strict';

const RazorpayAdapter = require('../gateways/razorpay/RazorpayAdapter');
const logger = require('../utils/logger');

// Instantiate adapters with environment variables
const razorpayAdapter = new RazorpayAdapter({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Resolves appropriate gateway adapter based on key. Defaults to Razorpay.
 */
function getAdapter(gateway = 'razorpay') {
  if (gateway === 'razorpay') {
    return razorpayAdapter;
  }
  throw new Error(`Unsupported payment gateway: ${gateway}`);
}

module.exports = {
  getAdapter,
};
