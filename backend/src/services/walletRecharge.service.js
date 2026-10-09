const { v4: uuidv4 } = require('uuid');
const razorpayService = require('./razorpay.service');
const walletRechargeRepo = require('../repositories/walletRechargeRequest.repository');
const { RazorpayOrder, WebhookIdempotency, sequelize, WalletRechargeTransaction } = require('../models');
const walletService = require('./wallet.service');
const eventBus = require('../events/eventBus');
const platformAuditService = require('./platformAudit.service');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

const MIN_RECHARGE_RUPEES = 1;
const MAX_RECHARGE_RUPEES = 100000;

/**
 * Initiate a wallet recharge — creates a Razorpay order and a recharge_request row.
 */
const initiateRecharge = async (sellerId, amountRupees) => {
  if (amountRupees < MIN_RECHARGE_RUPEES) throw new ValidationError(`Minimum recharge is ₹${MIN_RECHARGE_RUPEES}`);
  if (amountRupees > MAX_RECHARGE_RUPEES) throw new ValidationError(`Maximum recharge is ₹${MAX_RECHARGE_RUPEES}`);

  const amountPaise = Math.round(amountRupees * 100);
  const receipt = `recharge_${sellerId.slice(0, 8)}_${Date.now()}`;

  const rzpOrder = await razorpayService.createOrder({
    amountPaise,
    currency: 'INR',
    receipt,
    notes: { seller_id: sellerId, purpose: 'wallet_recharge' },
  });

  // Persist Razorpay order
  await RazorpayOrder.create({
    id: uuidv4(),
    seller_id: sellerId,
    razorpay_order_id: rzpOrder.id,
    amount_paise: amountPaise,
    currency: 'INR',
    status: 'created',
    notes: rzpOrder.notes,
  });

  // Persist recharge request
  await walletRechargeRepo.create({
    seller_id: sellerId,
    razorpay_order_id: rzpOrder.id,
    amount_rupees: amountRupees,
    status: 'initiated',
  });

  return {
    razorpayOrderId: rzpOrder.id,
    amountPaise,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

/**
 * Confirm recharge from webhook — called after signature verification.
 * All DB writes happen in a single transaction with idempotency guard.
 */
const confirmRecharge = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  if (razorpayPaymentId) {
    const existing = await WebhookIdempotency.findOne({
      where: { source: 'razorpay', event_id: razorpayPaymentId },
    });
    if (existing && existing.status === 'processed') {
      logger.info(`[WalletRecharge] Webhook already processed for payment: ${razorpayPaymentId}`);
      return;
    }
  }

  await sequelize.transaction(async (t) => {
    // 1. Fetch Razorpay order record or WalletRechargeTransaction record
    const rzpOrderRecord = await RazorpayOrder.findOne({
      where: { razorpay_order_id: razorpayOrderId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    const walletRechargeTx = await WalletRechargeTransaction.findOne({
      where: { gateway_order_id: razorpayOrderId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!rzpOrderRecord && !walletRechargeTx) {
      logger.warn(`[WalletRecharge] Unknown razorpay_order_id: ${razorpayOrderId}`);
      return;
    }

    // 2. Idempotency guard
    if (rzpOrderRecord && rzpOrderRecord.status === 'paid') {
      logger.info(`[WalletRecharge] Order already paid, skipping: ${razorpayOrderId}`);
      return;
    }
    if (walletRechargeTx && walletRechargeTx.status === 'success') {
      logger.info(`[WalletRecharge] WalletRechargeTransaction already credited, skipping: ${razorpayOrderId}`);
      return;
    }

    // 3. Save WebhookIdempotency record inside transaction
    if (razorpayPaymentId) {
      await WebhookIdempotency.upsert({
        source: 'razorpay',
        event_id: razorpayPaymentId,
        event_type: 'payment.captured',
        status: 'processed',
        processed_at: new Date(),
      }, { transaction: t });
    }

    const sellerId = rzpOrderRecord?.seller_id || walletRechargeTx?.tenant_id;
    const amountRupees = rzpOrderRecord ? (rzpOrderRecord.amount_paise / 100) : parseFloat(walletRechargeTx.amount);

    // 4. Mark order paid if RazorpayOrder exists
    if (rzpOrderRecord) {
      rzpOrderRecord.status = 'paid';
      rzpOrderRecord.razorpay_payment_id = razorpayPaymentId;
      rzpOrderRecord.razorpay_signature = razorpaySignature;
      rzpOrderRecord.paid_at = new Date();
      await rzpOrderRecord.save({ transaction: t });
    }

    // 5. Credit wallet reusing transaction t with returnDetails enabled
    const ledgerEntry = await walletService.credit(
      sellerId,
      amountRupees,
      'wallet_recharge',
      walletRechargeTx?.id || razorpayPaymentId,
      `Razorpay Payment ${razorpayPaymentId}`,
      null,
      t,
      true
    );

    // 6. Update WalletRechargeTransaction if exists
    if (walletRechargeTx) {
      await walletRechargeTx.update({
        status: 'success',
        gateway_payment_id: razorpayPaymentId,
        gateway_signature: razorpaySignature,
        wallet_transaction_id: ledgerEntry?.id || null,
        reconciled_at: new Date(),
        reconciled_by: 'webhook',
      }, { transaction: t });
    }

    // 7. Update recharge request repository if exists
    if (rzpOrderRecord) {
      await walletRechargeRepo.updateByRazorpayOrderId(razorpayOrderId, {
        status: 'success',
        wallet_ledger_entry_id: ledgerEntry?.id || null,
        completed_at: new Date(),
      }, t);
    }

    // 8. Emit event (post-commit)
    setImmediate(() => {
      eventBus.emit('wallet.recharged', {
        seller_id: sellerId,
        amount_rupees: amountRupees,
        razorpay_order_id: razorpayOrderId,
      });
    });

    logger.info(`[WalletRecharge] Confirmed ₹${amountRupees} for seller ${sellerId}`);
  });
};

/**
 * Mark recharge as failed.
 */
const failRecharge = async (razorpayOrderId, reason) => {
  await RazorpayOrder.update({ status: 'failed' }, { where: { razorpay_order_id: razorpayOrderId } });
  await walletRechargeRepo.updateByRazorpayOrderId(razorpayOrderId, {
    status: 'failed',
    failure_reason: reason,
    completed_at: new Date(),
  });
};

/**
 * Get recharge history for a seller.
 */
const getRechargeHistory = async (sellerId, page = 1, limit = 20) => {
  return walletRechargeRepo.findBySeller(sellerId, page, limit);
};

module.exports = { initiateRecharge, confirmRecharge, failRecharge, getRechargeHistory };
