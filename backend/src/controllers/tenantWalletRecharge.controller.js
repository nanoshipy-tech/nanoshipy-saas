'use strict';

const { PaymentGateway, WalletRechargeTransaction, Wallet, WalletTransaction, Invoice, Tenant } = require('../models');
const { decrypt } = require('../utils/encryption.util');
const { success, error } = require('../utils/apiResponse');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Get active payment gateway config & presets for tenant recharge
 */
exports.getRechargeConfig = async (req, res) => {
  try {
    const activeGateway = await PaymentGateway.findOne({
      where: { is_active: true, is_default: true },
    }) || await PaymentGateway.findOne({
      where: { is_active: true },
    });

    if (!activeGateway) {
      return success(res, {
        gateway: 'manual',
        mode: 'live',
        api_key: null,
        min_recharge: 1,
        max_recharge: 100000,
        presets: [100, 500, 1000, 2000, 5000],
        fee_percent: 0,
        auto_gst_invoice: true,
      });
    }

    const config = activeGateway.config || {};
    return success(res, {
      gateway: activeGateway.name,
      display_name: activeGateway.display_name,
      mode: activeGateway.mode,
      api_key: activeGateway.api_key,
      min_recharge: config.min_recharge !== undefined ? config.min_recharge : 1,
      max_recharge: config.max_recharge || 100000,
      presets: config.presets || [100, 500, 1000, 2000, 5000],
      fee_percent: config.fee_percent || 0,
      auto_gst_invoice: config.auto_gst_invoice !== false,
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Get available coupons for the authenticated merchant
 */
exports.getAvailableCoupons = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { Coupon, CouponUsage } = require('../models');
    const { Op } = require('sequelize');

    const now = new Date();
    // Fetch active coupons that are currently valid
    const coupons = await Coupon.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          {
            [Op.or]: [
              { valid_from: null },
              { valid_from: { [Op.lte]: now } }
            ]
          },
          {
            [Op.or]: [
              { valid_until: null },
              { valid_until: { [Op.gte]: now } }
            ]
          }
        ]
      },
      order: [['min_recharge_amount', 'ASC']],
    });

    // Check usage limits per user/tenant
    const tenantUsages = await CouponUsage.findAll({
      where: { tenant_id: tenantId },
      attributes: ['coupon_id'],
    });

    const usageCounts = {};
    tenantUsages.forEach(u => {
      usageCounts[u.coupon_id] = (usageCounts[u.coupon_id] || 0) + 1;
    });

    const availableCoupons = coupons
      .filter(coupon => {
        // Total redemptions limit check
        if (coupon.usage_limit_total && coupon.used_count >= coupon.usage_limit_total) {
          return false;
        }
        // Per-user limit check
        const userUsed = usageCounts[coupon.id] || 0;
        if (userUsed >= (coupon.usage_limit_per_user || 1)) {
          return false;
        }
        return true;
      })
      .map(c => ({
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        benefit_type: c.benefit_type,
        discount_type: c.discount_type,
        discount_value: parseFloat(c.discount_value || 0),
        min_recharge_amount: parseFloat(c.min_recharge_amount || 0),
        max_discount_amount: c.max_discount_amount ? parseFloat(c.max_discount_amount) : null,
        valid_until: c.valid_until,
      }));

    return success(res, { coupons: availableCoupons });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Validate coupon for wallet recharge
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body;
    const tenantId = req.user.tenant_id;
    const couponService = require('../services/coupon.service');
    const result = await couponService.validateCoupon(tenantId, code, amount);
    return success(res, result);
  } catch (err) {
    return error(res, { code: 'BAD_REQUEST', message: err.message }, 400);
  }
};

/**
 * Initiate a wallet recharge order
 */
exports.initiateRecharge = async (req, res) => {
  try {
    const { amount, coupon_code } = req.body;
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return error(res, { code: 'BAD_REQUEST', message: 'Please enter a valid positive recharge amount.' }, 400);
    }

    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    let activeGateway = await PaymentGateway.findOne({ where: { is_active: true, is_default: true } })
      || await PaymentGateway.findOne({ where: { is_active: true } });

    if (!activeGateway) {
      return error(res, { code: 'BAD_REQUEST', message: 'No active payment gateway configured on platform.' }, 400);
    }

    const config = activeGateway.config || {};
    const minRecharge = config.min_recharge !== undefined ? config.min_recharge : 1;
    const maxRecharge = config.max_recharge || 500000;

    if (numAmount < minRecharge) {
      return error(res, { code: 'BAD_REQUEST', message: `Minimum recharge amount is ₹${minRecharge}` }, 400);
    }
    if (numAmount > maxRecharge) {
      return error(res, { code: 'BAD_REQUEST', message: `Maximum recharge limit is ₹${maxRecharge}` }, 400);
    }

    // Handle Coupon if supplied
    let couponData = null;
    let payableBase = numAmount;
    let benefitAmount = 0;
    let benefitType = null;

    if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim()) {
      const couponService = require('../services/coupon.service');
      couponData = await couponService.validateCoupon(tenantId, coupon_code.trim(), numAmount);
      benefitAmount = couponData.benefit_amount;
      benefitType = couponData.benefit_type;

      if (benefitType === 'discount') {
        payableBase = Math.max(0, numAmount - benefitAmount);
      }
    }

    const feePercent = config.fee_percent || 0;
    const feeAmount = (payableBase * feePercent) / 100;
    const gstAmount = config.auto_gst_invoice ? (feeAmount * 0.18) : 0;
    const totalAmount = payableBase + feeAmount + gstAmount;

    let gatewayOrderId = null;
    let checkoutParams = {};

    if (activeGateway.name === 'razorpay') {
      let rawKey = activeGateway.api_key;
      let rawSecret = decrypt(activeGateway.api_secret) || activeGateway.api_secret;

      const amountPaise = Math.round(totalAmount * 100);

      if (rawKey && rawSecret && !rawKey.includes('demoKey') && !rawKey.includes('simulatedKey')) {
        try {
          const rzp = new Razorpay({ key_id: rawKey, key_secret: rawSecret });
          const rzpOrder = await rzp.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `rcg_${Date.now()}`,
            notes: { tenant_id: tenantId, user_id: userId, recharge_amount: numAmount },
          });
          gatewayOrderId = rzpOrder.id;
        } catch (rzpErr) {
          logger.warn('[TenantWalletRecharge] Razorpay API order creation failed:', { error: rzpErr.message });
          if (activeGateway.mode === 'test' || !activeGateway.api_secret) {
            gatewayOrderId = `order_sim_${Date.now()}`;
          } else {
            return error(res, { code: 'PAYMENT_GATEWAY_ERROR', message: `Razorpay Order Creation Failed: Please update valid Razorpay API keys in Admin Console (${rzpErr.message})` }, 400);
          }
        }
      } else {
        // Test / Demo mode fallback for preview/testing
        rawKey = rawKey && !rawKey.includes('demoKey') ? rawKey : 'rzp_test_simulatedKey';
        gatewayOrderId = `order_sim_${Date.now()}`;
      }

      checkoutParams = {
        key: rawKey,
        amount: amountPaise,
        currency: 'INR',
        name: 'Nanoshipy Wallet Recharge',
        description: `Top-up ₹${numAmount.toFixed(2)} to wallet`,
        order_id: gatewayOrderId,
      };
    } else {
      gatewayOrderId = `MAN_${Date.now()}`;
      checkoutParams = { manual: true, message: 'Please transfer funds to bank account.' };
    }

    const rechargeTx = await WalletRechargeTransaction.create({
      tenant_id: tenantId,
      user_id: userId,
      gateway_id: activeGateway.id,
      gateway_name: activeGateway.name,
      gateway_order_id: gatewayOrderId,
      amount: numAmount,
      fee_amount: feeAmount,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      coupon_id: couponData ? couponData.coupon.id : null,
      coupon_code: couponData ? couponData.coupon.code : null,
      coupon_benefit_amount: benefitAmount,
      coupon_benefit_type: benefitType,
      status: 'initiated',
    });

    return success(res, {
      recharge_id: rechargeTx.id,
      gateway: activeGateway.name,
      gateway_order_id: gatewayOrderId,
      amount: numAmount,
      payable_base: payableBase,
      fee_amount: feeAmount,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      coupon: couponData ? {
        code: couponData.coupon.code,
        title: couponData.coupon.title,
        benefit_type: benefitType,
        benefit_amount: benefitAmount,
      } : null,
      checkout_params: checkoutParams,
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Verify payment signature & credit wallet
 */
exports.verifyPayment = async (req, res) => {
  const { id } = req.params;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const t = await WalletRechargeTransaction.sequelize.transaction();
  try {
    const tx = await WalletRechargeTransaction.findOne({
      where: { id, tenant_id: req.user.tenant_id },
      transaction: t,
    });

    if (!tx) {
      await t.rollback();
      return error(res, { code: 'NOT_FOUND', message: 'Recharge transaction not found' }, 404);
    }

    if (tx.status === 'success') {
      await t.rollback();
      return success(res, { status: 'success', message: 'Transaction already verified and credited.' });
    }

    const gateway = await PaymentGateway.findOne({ where: { name: tx.gateway_name } });
    if (!gateway) {
      await t.rollback();
      return error(res, { code: 'BAD_REQUEST', message: 'Gateway configuration missing' }, 400);
    }

    let isValid = false;

    if (tx.gateway_name === 'razorpay') {
      const rawSecret = decrypt(gateway.api_secret) || gateway.api_secret;
      const rzpOrderId = razorpay_order_id || tx.gateway_order_id;

      if (razorpay_signature && rawSecret) {
        const body = rzpOrderId + '|' + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac('sha256', rawSecret)
          .update(body.toString())
          .digest('hex');

        isValid = expectedSignature === razorpay_signature;
      }

      if (!isValid && gateway.api_key && rawSecret) {
        if (gateway.mode === 'test' && razorpay_payment_id?.startsWith('pay_sim_')) {
          isValid = true;
        } else {
          try {
            const rzp = new Razorpay({ key_id: gateway.api_key, key_secret: rawSecret });
            if (razorpay_payment_id) {
              const pmt = await rzp.payments.fetch(razorpay_payment_id);
              if (pmt && (pmt.status === 'captured' || pmt.status === 'authorized')) {
                isValid = true;
              }
            }
          } catch (rzpErr) {
            logger.warn('Razorpay payment fetch fallback:', { error: rzpErr.message });
            if (gateway.mode === 'test') isValid = true;
          }
        }
      }
    } else {
      // Non-Razorpay gateways must not bypass verification; fail closed
      logger.warn(`[SecurityEvent] Direct recharge verification attempted for unverified gateway "${tx.gateway_name}". Rejected (fail-closed).`);
      isValid = false;
    }

    if (!isValid) {
      await tx.update({ status: 'failed', failure_reason: 'Invalid signature or payment failed' }, { transaction: t });
      await t.commit();
      return error(res, { code: 'BAD_REQUEST', message: 'Payment verification failed' }, 400);
    }

    const walletService = require('../services/wallet.service');
    let creditAmount = parseFloat(tx.amount);
    let memo = `Wallet top-up via ${tx.gateway_name.toUpperCase()} (Ref: ${razorpay_payment_id || tx.gateway_order_id})`;

    if (tx.coupon_id && parseFloat(tx.coupon_benefit_amount) > 0) {
      const couponService = require('../services/coupon.service');
      await couponService.recordCouponUsage(
        tx.tenant_id,
        req.user.id,
        tx.id,
        tx.coupon_id,
        tx.amount,
        tx.coupon_benefit_amount,
        tx.coupon_benefit_type,
        t
      );

      if (tx.coupon_benefit_type === 'bonus_credit') {
        const bonus = parseFloat(tx.coupon_benefit_amount);
        creditAmount = parseFloat(tx.amount) + bonus;
        memo += ` (Includes ₹${bonus.toFixed(2)} Bonus via Coupon ${tx.coupon_code})`;
      } else if (tx.coupon_benefit_type === 'discount') {
        memo += ` (Discounted ₹${parseFloat(tx.coupon_benefit_amount).toFixed(2)} via Coupon ${tx.coupon_code})`;
      }
    }

    const creditResult = await walletService.credit(
      tx.tenant_id,
      creditAmount,
      'wallet_recharge',
      tx.id,
      memo,
      req.user.id,
      t,
      true
    );

    const newBalance = typeof creditResult === 'object' ? creditResult.balance : creditResult;
    const ledgerId = typeof creditResult === 'object' ? (creditResult.id || creditResult.transaction?.id) : null;

    await tx.update({
      status: 'success',
      gateway_payment_id: razorpay_payment_id || tx.gateway_payment_id,
      gateway_signature: razorpay_signature || tx.gateway_signature,
      wallet_transaction_id: ledgerId,
      reconciled_at: new Date(),
      reconciled_by: 'client_verify',
    }, { transaction: t });

    await t.commit();

    // Auto-generate GST Recharge Invoice PDF
    const invoiceService = require('../services/invoice.service');
    const rechargeInvoice = await invoiceService.createRechargeInvoice(tx.id).catch(() => null);

    return success(res, {
      status: 'success',
      amount: creditAmount,
      base_recharge_amount: parseFloat(tx.amount),
      coupon_bonus: tx.coupon_benefit_type === 'bonus_credit' ? parseFloat(tx.coupon_benefit_amount) : 0,
      coupon_discount: tx.coupon_benefit_type === 'discount' ? parseFloat(tx.coupon_benefit_amount) : 0,
      coupon_code: tx.coupon_code || null,
      new_balance: newBalance,
      recharge_id: tx.id,
      invoice_number: rechargeInvoice ? rechargeInvoice.invoice_number : null,
      pdf_url: rechargeInvoice ? rechargeInvoice.pdf_url : null,
    });
  } catch (err) {
    await t.rollback();
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Get tenant's recharge transaction history
 */
exports.getRechargeHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await WalletRechargeTransaction.findAndCountAll({
      where: { tenant_id: req.user.tenant_id },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return success(res, {
      history: rows,
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};
