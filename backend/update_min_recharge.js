'use strict';

require('dotenv').config();
const { PaymentGateway } = require('./src/models');

async function updateConfig() {
  const razorpay = await PaymentGateway.findOne({ where: { name: 'razorpay' } });
  if (razorpay) {
    razorpay.config = {
      min_recharge: 1,
      max_recharge: 100000,
      presets: [100, 500, 1000, 2000, 5000],
      fee_percent: 0,
      auto_gst_invoice: true,
    };
    await razorpay.save();
    console.log('[UpdateConfig] Successfully updated Razorpay min_recharge to 1 in DB');
  } else {
    console.log('[UpdateConfig] Razorpay gateway not found in DB');
  }
  process.exit(0);
}

updateConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
