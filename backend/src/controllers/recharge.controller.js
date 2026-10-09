'use strict';

const rechargeService = require('../services/recharge.service');
const { success } = require('../utils/apiResponse');

/**
 * Initiate recharge - creates a gateway order.
 */
async function initiate(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { amount } = req.body;

    const data = await rechargeService.initiateRecharge(tenantId, userId, amount);
    return success(res, data, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Verify recharge payment - checks checkout signature client side.
 */
async function verify(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { recharge_order_id, gateway_payment_id, gateway_signature } = req.body;

    const data = await rechargeService.verifyRechargePayment(
      tenantId,
      userId,
      recharge_order_id,
      gateway_payment_id,
      gateway_signature
    );

    return success(res, data);
  } catch (err) {
    next(err);
  }
}

/**
 * Public Webhook - payment server confirmation.
 */
async function webhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
    // Express raw body parsing is needed here to get exact raw body string
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await rechargeService.handleGatewayWebhook(
      'razorpay',
      signature,
      rawBody,
      webhookSecret
    );

    return success(res, result);
  } catch (err) {
    // If webhook signature is invalid or error occurs, return error response but keep log
    next(err);
  }
}

module.exports = {
  initiate,
  verify,
  webhook,
};
