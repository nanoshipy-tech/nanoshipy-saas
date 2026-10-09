'use strict';

const { Coupon, CouponUsage } = require('../models');

/**
 * Validate coupon code eligibility and compute discount / bonus credit
 */
async function validateCoupon(tenantId, code, rechargeAmount) {
  if (!code || typeof code !== 'string') {
    throw new Error('Please provide a coupon code.');
  }

  const cleanCode = code.trim().toUpperCase();
  const numAmount = parseFloat(rechargeAmount);

  if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Please enter a valid recharge amount before applying a coupon.');
  }

  const coupon = await Coupon.findOne({
    where: { code: cleanCode },
  });

  if (!coupon) {
    throw new Error(`Coupon code "${cleanCode}" is invalid.`);
  }

  if (!coupon.is_active) {
    throw new Error(`Coupon code "${cleanCode}" is currently inactive.`);
  }

  const now = new Date();
  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    throw new Error(`Coupon code "${cleanCode}" is not active yet.`);
  }

  if (coupon.valid_until && now > new Date(coupon.valid_until)) {
    throw new Error(`Coupon code "${cleanCode}" has expired.`);
  }

  if (coupon.usage_limit_total && coupon.used_count >= coupon.usage_limit_total) {
    throw new Error(`Coupon code "${cleanCode}" has reached its maximum total redemptions.`);
  }

  if (tenantId) {
    const userUsageCount = await CouponUsage.count({
      where: {
        coupon_id: coupon.id,
        tenant_id: tenantId,
      },
    });

    if (userUsageCount >= (coupon.usage_limit_per_user || 1)) {
      throw new Error(`You have already redeemed coupon "${cleanCode}" the maximum allowed number of times.`);
    }
  }

  const minRecharge = parseFloat(coupon.min_recharge_amount || 0);
  if (numAmount < minRecharge) {
    throw new Error(`Minimum recharge of ₹${minRecharge.toLocaleString('en-IN')} required to apply coupon "${cleanCode}".`);
  }

  // Calculate benefit value
  let benefit = 0;
  const discountVal = parseFloat(coupon.discount_value || 0);

  if (coupon.discount_type === 'percentage') {
    benefit = (numAmount * discountVal) / 100;
  } else {
    benefit = discountVal;
  }

  if (coupon.max_discount_amount) {
    const maxCap = parseFloat(coupon.max_discount_amount);
    if (benefit > maxCap) {
      benefit = maxCap;
    }
  }

  benefit = Math.round(benefit * 100) / 100;

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      benefit_type: coupon.benefit_type,
      discount_type: coupon.discount_type,
      discount_value: discountVal,
      min_recharge_amount: minRecharge,
      max_discount_amount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null,
    },
    benefit_amount: benefit,
    benefit_type: coupon.benefit_type,
  };
}

/**
 * Record coupon redemption usage in atomic transaction
 */
async function recordCouponUsage(tenantId, userId, rechargeId, couponId, rechargeAmount, benefitAmount, benefitType, transaction = null) {
  const usage = await CouponUsage.create({
    coupon_id: couponId,
    tenant_id: tenantId,
    user_id: userId || null,
    recharge_id: rechargeId || null,
    recharge_amount: rechargeAmount,
    benefit_amount: benefitAmount,
    benefit_type: benefitType,
  }, { transaction });

  const coupon = await Coupon.findByPk(couponId, { transaction });
  if (coupon) {
    await coupon.increment('used_count', { by: 1, transaction });
  }

  return usage;
}

module.exports = {
  validateCoupon,
  recordCouponUsage,
};
