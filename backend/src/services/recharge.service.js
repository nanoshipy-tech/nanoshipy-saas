'use strict';

const { RechargeOrder, Wallet, sequelize, User } = require('../models');
const { NotFoundError, PaymentSignatureInvalidError, RechargeOrderNotFoundError } = require('../utils/errors');
const paymentGateway = require('./paymentGateway.service');
const walletService = require('./wallet.service');
const emailService = require('./email.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');

/**
 * Initiate recharge sequence.
 */
async function initiateRecharge(tenantId, userId, amount) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 100 || amt > 500000) {
    throw new Error('Recharge amount must be between ₹100 and ₹5,000,000');
  }

  const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
  if (!wallet) {
    throw new NotFoundError('Wallet not found for this tenant');
  }

  // 1. Create a database record for traceability
  const order = await RechargeOrder.create({
    tenant_id: tenantId,
    wallet_id: wallet.id,
    amount: amt,
    gateway: 'razorpay',
    gateway_order_id: 'pending_initiation',
    status: 'created',
    initiated_by: userId,
  });

  // 2. Transmit to gateway adapter
  const adapter = paymentGateway.getAdapter('razorpay');
  const gatewayOrder = await adapter.createOrder({
    amount: amt,
    currency: 'INR',
    receiptId: order.id,
  });

  // 3. Update database record with the gateway order reference
  await order.update({
    gateway_order_id: gatewayOrder.gatewayOrderId,
    status: 'pending',
  });

  // 4. Log audit log
  await auditService.log({
    tenant_id: tenantId,
    user_id: userId,
    action: 'wallet_recharge_initiated',
    entity_type: 'recharge_orders',
    entity_id: order.id,
    metadata: { amount: amt, gateway_order_id: gatewayOrder.gatewayOrderId },
  });

  return {
    recharge_order_id: order.id,
    gateway_order_id: gatewayOrder.gatewayOrderId,
    amount: amt,
    currency: 'INR',
    razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  };
}

/**
 * Verify payment checkin. Uses Sequelize locking transaction to prevent double confirmation.
 */
async function verifyRechargePayment(tenantId, userId, rechargeOrderId, gatewayPaymentId, gatewaySignature) {
  // 1. Lock the recharge order record to prevent concurrency with webhook
  const order = await RechargeOrder.findOne({
    where: { id: rechargeOrderId, tenant_id: tenantId },
  });

  if (!order) {
    throw new RechargeOrderNotFoundError();
  }

  // Idempotency: if already marked success, return balance directly (no-op success)
  if (order.status === 'success') {
    const wallet = await Wallet.findByPk(order.wallet_id);
    return {
      status: 'success',
      new_balance: parseFloat(wallet.balance),
    };
  }

  // 2. Validate signature with the gateway
  const adapter = paymentGateway.getAdapter(order.gateway);
  const isValid = await adapter.verifyPaymentSignature({
    gatewayOrderId: order.gateway_order_id,
    gatewayPaymentId,
    gatewaySignature,
  });

  if (!isValid) {
    await order.update({ status: 'failed' });
    throw new PaymentSignatureInvalidError();
  }

  // 3. Mark success and credit wallet in a single atomic transaction
  const newBalance = await sequelize.transaction(async (t) => {
    // Reload order within lock transaction
    const lockedOrder = await RechargeOrder.findByPk(order.id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (lockedOrder.status === 'success') {
      const wallet = await Wallet.findByPk(lockedOrder.wallet_id, { transaction: t });
      return parseFloat(wallet.balance);
    }

    // Credit wallet
    const updatedBalance = await walletService.credit(
      tenantId,
      lockedOrder.amount,
      'recharge',
      lockedOrder.id,
      `Recharge success - Gateway Ref #${gatewayPaymentId}`,
      userId,
      t
    );

    // Update order status
    await lockedOrder.update({
      gateway_payment_id: gatewayPaymentId,
      status: 'success',
      completed_at: new Date(),
    }, { transaction: t });

    return updatedBalance;
  });

  // 4. Send email confirmation (non-blocking)
  const user = await User.findByPk(userId);
  if (user) {
    await emailService.sendEmail({
      to: user.email,
      subject: 'Wallet recharge successful!',
      templateName: 'recharge-success',
      data: {
        name: user.name,
        amount: order.amount.toFixed(2),
        paymentId: gatewayPaymentId,
        newBalance: newBalance.toFixed(2),
      },
    });
  }

  return {
    status: 'success',
    new_balance: newBalance,
  };
}

/**
 * Handle incoming server-to-server gateway webhooks.
 */
async function handleGatewayWebhook(gateway, signature, rawBody, webhookSecret) {
  const adapter = paymentGateway.getAdapter(gateway);
  
  // Verify webhook signature
  const isValid = adapter.verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    logger.warn(`[RechargeService] Invalid webhook signature detected for gateway: ${gateway}`);
    throw new PaymentSignatureInvalidError('Webhook signature validation failed');
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event;
  logger.info(`[RechargeService] Received Webhook Event: ${event} from ${gateway}`);

  // Handle successful capture events
  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentEntity = payload.payload.payment.entity;
    const gatewayOrderId = paymentEntity.order_id;
    const gatewayPaymentId = paymentEntity.id;

    if (!gatewayOrderId) {
      logger.info('[RechargeService] Webhook event skipped - no order_id associated.');
      return { success: true, message: 'Skipped - no order_id' };
    }

    // Find our order record
    const order = await RechargeOrder.findOne({
      where: { gateway_order_id: gatewayOrderId },
    });

    if (!order) {
      logger.warn(`[RechargeService] Webhook received order_id ${gatewayOrderId} but record not found in system.`);
      throw new RechargeOrderNotFoundError();
    }

    if (order.status === 'success') {
      logger.info(`[RechargeService] Webhook ignored - Recharge order ${order.id} is already success (idempotent no-op).`);
      return { success: true, message: 'Already completed (no-op)' };
    }

    // Atomically credit and complete
    await sequelize.transaction(async (t) => {
      const lockedOrder = await RechargeOrder.findByPk(order.id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (lockedOrder.status === 'success') return;

      await walletService.credit(
        lockedOrder.tenant_id,
        lockedOrder.amount,
        'recharge',
        lockedOrder.id,
        `Recharge success via Webhook - Gateway Ref #${gatewayPaymentId}`,
        lockedOrder.initiated_by,
        t
      );

      await lockedOrder.update({
        gateway_payment_id: gatewayPaymentId,
        status: 'success',
        completed_at: new Date(),
      }, { transaction: t });
    });

    logger.info(`[RechargeService] Webhook successfully processed recharge order ${order.id}.`);
  }

  return { success: true };
}

module.exports = {
  initiateRecharge,
  verifyRechargePayment,
  handleGatewayWebhook,
};
