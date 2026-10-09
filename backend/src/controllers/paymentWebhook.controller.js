'use strict';

const { Op } = require('sequelize');
const { PaymentGateway, WalletRechargeTransaction, Wallet, WalletTransaction, Invoice } = require('../models');
const { decrypt } = require('../utils/encryption.util');
const { getRedisClient } = require('../config/redis.config');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Distributed Lock Helpers for Webhook Processing
 */
async function acquireLock(key, ttlMs = 15000) {
  try {
    const client = getRedisClient();
    if (client && typeof client.set === 'function') {
      const acquired = await client.set(key, 'locked', 'PX', ttlMs, 'NX');
      return !!acquired;
    }
  } catch (e) {
    // fallback to memory map
  }
  if (!global._rechargeLocks) global._rechargeLocks = new Map();
  const now = Date.now();
  const exp = global._rechargeLocks.get(key);
  if (exp && exp > now) {
    return false;
  }
  global._rechargeLocks.set(key, now + ttlMs);
  return true;
}

async function releaseLock(key) {
  try {
    const client = getRedisClient();
    if (client && typeof client.del === 'function') {
      await client.del(key);
    }
  } catch (e) {}
  if (global._rechargeLocks) {
    global._rechargeLocks.delete(key);
  }
}

/**
 * Public Server-to-Server Payment Webhook Receiver
 * Endpoint: POST /api/v1/webhooks/payments/:provider
 */
exports.handlePaymentWebhook = async (req, res) => {
  const { provider } = req.params;
  logger.info(`[PaymentWebhook] Received ${provider} webhook payload`);

  try {
    const gateway = await PaymentGateway.findOne({ where: { name: provider } });
    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    const rawWebhookSecret = decrypt(gateway.webhook_secret) || gateway.webhook_secret;

    if (provider === 'razorpay') {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature || !rawWebhookSecret) {
        logger.warn('[SecurityEvent] Razorpay webhook rejected: signature header or secret missing');
        return res.status(400).json({ success: false, message: 'Invalid or missing webhook signature' });
      }

      const payloadData = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', rawWebhookSecret)
        .update(payloadData)
        .digest('hex');

      if (expectedSignature !== signature) {
        logger.warn('[SecurityEvent] Razorpay webhook rejected: invalid signature');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }

      const event = req.body.event;
      const payload = req.body.payload;

      if (event === 'payment.captured' || event === 'order.paid') {
        const paymentEntity = payload.payment ? payload.payment.entity : null;
        const orderId = paymentEntity ? paymentEntity.order_id : (payload.order ? payload.order.entity.id : null);
        const paymentId = paymentEntity ? paymentEntity.id : null;

        if (orderId) {
          await processSuccessfulRecharge(orderId, paymentId, 'razorpay_webhook');
        }
      } else if (event === 'payment.failed') {
        const paymentEntity = payload.payment ? payload.payment.entity : null;
        const orderId = paymentEntity ? paymentEntity.order_id : null;
        const reason = paymentEntity?.error_description || 'Payment failed';

        if (orderId) {
          await processFailedRecharge(orderId, reason);
        }
      }
    } else if (provider === 'cashfree') {
      const signature = req.headers['x-webhook-signature'];
      const timestamp = req.headers['x-webhook-timestamp'];
      if (!signature || !timestamp || !rawWebhookSecret) {
        logger.warn('[SecurityEvent] Cashfree webhook rejected: signature, timestamp, or secret missing');
        return res.status(400).json({ success: false, message: 'Invalid or missing Cashfree webhook signature' });
      }

      const payloadData = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      const signedData = timestamp + payloadData;
      const expectedSignature = crypto
        .createHmac('sha256', rawWebhookSecret)
        .update(signedData)
        .digest('base64');

      if (expectedSignature !== signature) {
        logger.warn('[SecurityEvent] Cashfree webhook rejected: invalid signature');
        return res.status(400).json({ success: false, message: 'Invalid Cashfree webhook signature' });
      }

      const orderId = req.body.data?.order?.order_id || req.body.order_id;
      const paymentId = req.body.data?.payment?.cf_payment_id || req.body.payment_id;
      const paymentStatus = req.body.data?.payment?.payment_status || req.body.txStatus;

      if (paymentStatus === 'SUCCESS' && orderId) {
        await processSuccessfulRecharge(orderId, String(paymentId), 'cashfree_webhook');
      } else if (paymentStatus === 'FAILED' && orderId) {
        await processFailedRecharge(orderId, 'Cashfree payment failed');
      }
    } else if (provider === 'payu') {
      const { hash, txnid, amount, productinfo, firstname, email, status, key } = req.body || {};
      const salt = rawWebhookSecret;
      if (!hash || !salt || !txnid) {
        logger.warn('[SecurityEvent] PayU webhook rejected: hash, salt, or txnid missing');
        return res.status(400).json({ success: false, message: 'Invalid or missing PayU webhook signature' });
      }

      // Reverse hash formula: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
      const udf1 = req.body.udf1 || '';
      const udf2 = req.body.udf2 || '';
      const udf3 = req.body.udf3 || '';
      const udf4 = req.body.udf4 || '';
      const udf5 = req.body.udf5 || '';
      const hashSequence = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email || ''}|${firstname || ''}|${productinfo || ''}|${amount || ''}|${txnid}|${key || ''}`;
      const expectedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');

      if (expectedHash.toLowerCase() !== String(hash).toLowerCase()) {
        logger.warn('[SecurityEvent] PayU webhook rejected: invalid reverse hash');
        return res.status(400).json({ success: false, message: 'Invalid PayU webhook signature' });
      }

      const paymentId = req.body.mihpayid;
      if (status === 'success') {
        await processSuccessfulRecharge(txnid, String(paymentId), 'payu_webhook');
      } else {
        await processFailedRecharge(txnid, 'PayU payment failed');
      }
    } else {
      // Fail closed for any gateway without implemented verification
      logger.warn(`[SecurityEvent] Webhook received for unsupported/unverified gateway "${provider}". Rejected (fail-closed).`);
      return res.status(400).json({
        success: false,
        message: `Webhook signature verification is not implemented for gateway "${provider}" (fail-closed).`
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (err) {
    logger.error('[PaymentWebhook] Processing error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Idempotent Atomic Wallet Credit Helper with Distributed Lock & Constraint Protection
 */
async function processSuccessfulRecharge(gatewayOrderId, gatewayPaymentId, source) {
  const lockKey = `lock:payment:${gatewayPaymentId || gatewayOrderId}`;
  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    logger.warn(`[PaymentWebhook] Lock contention detected for ${lockKey}. Skipping duplicate.`);
    return;
  }

  try {
    // Idempotency: verify if already credited by payment ID
    if (gatewayPaymentId) {
      const existingLedger = await WalletTransaction.findOne({
        where: {
          [Op.or]: [
            { gateway_payment_id: gatewayPaymentId },
            { razorpay_payment_id: gatewayPaymentId },
          ],
        },
      });
      if (existingLedger) {
        logger.info(`[PaymentWebhook] Payment ${gatewayPaymentId} already credited in WalletTransaction ${existingLedger.id}. Skipping.`);
        return;
      }
    }

    const t = await WalletRechargeTransaction.sequelize.transaction();
    try {
      const tx = await WalletRechargeTransaction.findOne({
        where: { gateway_order_id: gatewayOrderId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!tx) {
        logger.warn(`[PaymentWebhook] Recharge transaction not found for order ${gatewayOrderId}`);
        await t.rollback();
        return;
      }

      // Idempotency check on recharge transaction
      if (tx.status === 'success') {
        logger.info(`[PaymentWebhook] Transaction ${tx.id} already credited. Skipping duplicate.`);
        await t.rollback();
        return;
      }

      let wallet = await Wallet.findOne({ where: { tenant_id: tx.tenant_id }, transaction: t });
      if (!wallet) {
        wallet = await Wallet.create({ tenant_id: tx.tenant_id, balance: 0 }, { transaction: t });
      }

      const prevBalance = parseFloat(wallet.balance);
      const creditAmount = parseFloat(tx.amount);
      const newBalance = prevBalance + creditAmount;

      await wallet.update({ balance: newBalance }, { transaction: t });

      const ledger = await WalletTransaction.create({
        wallet_id: wallet.id,
        tenant_id: tx.tenant_id,
        type: 'credit',
        amount: creditAmount,
        balance_after: newBalance,
        reference_type: 'gateway_recharge',
        reference_id: tx.id,
        gateway_payment_id: gatewayPaymentId || null,
        razorpay_payment_id: gatewayPaymentId || null,
        description: `Wallet top-up via ${tx.gateway_name.toUpperCase()} (Webhook)`,
        performed_by: tx.user_id,
      }, { transaction: t });

      await tx.update({
        status: 'success',
        gateway_payment_id: gatewayPaymentId || tx.gateway_payment_id,
        wallet_transaction_id: ledger.id,
        reconciled_at: new Date(),
        reconciled_by: source,
      }, { transaction: t });

      await t.commit();
      logger.info(`[PaymentWebhook] Successfully credited ₹${creditAmount} to tenant ${tx.tenant_id}`);
    } catch (err) {
      await t.rollback();
      logger.error('[PaymentWebhook] Transaction rollback error:', err);
    }
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Handle Failed Recharge Helper
 */
async function processFailedRecharge(gatewayOrderId, reason) {
  try {
    const tx = await WalletRechargeTransaction.findOne({ where: { gateway_order_id: gatewayOrderId } });
    if (tx && tx.status !== 'success') {
      await tx.update({
        status: 'failed',
        failure_reason: reason || 'Payment failed',
      });
      logger.info(`[PaymentWebhook] Recharge transaction ${tx.id} marked as failed: ${reason}`);
    }
  } catch (err) {
    logger.error('[PaymentWebhook] processFailedRecharge error:', err);
  }
}


