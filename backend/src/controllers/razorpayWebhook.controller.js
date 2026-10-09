const razorpayService = require('../services/razorpay.service');
const walletRechargeService = require('../services/walletRecharge.service');
const logger = require('../utils/logger');

const handleWebhook = async (req, res, next) => {
  try {
    const rawBody = req.rawBody; // set by express.raw() middleware on this route
    const signature = req.headers['x-razorpay-signature'];

    if (!rawBody || !signature) {
      return res.status(400).json({ error: 'Missing body or signature' });
    }

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('[RazorpayWebhook] Invalid signature — rejecting');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Acknowledge immediately before processing
    res.status(200).json({ received: true });

    // Parse body and process async
    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      logger.warn('[RazorpayWebhook] Could not parse JSON body');
      return;
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity || {};

    setImmediate(async () => {
      try {
        if (event === 'payment.captured') {
          await walletRechargeService.confirmRecharge(
            paymentEntity.order_id,
            paymentEntity.id,
            signature
          );
        } else if (event === 'payment.failed') {
          await walletRechargeService.failRecharge(
            paymentEntity.order_id,
            paymentEntity.error_description || 'Payment failed'
          );
        }
        // refund.created — handled if needed in future
      } catch (err) {
        logger.error(`[RazorpayWebhook] Processing error for event ${event}: ${err.message}`, { stack: err.stack });
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { handleWebhook };
