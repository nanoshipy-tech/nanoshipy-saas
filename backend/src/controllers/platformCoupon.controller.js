'use strict';

const { Coupon, CouponUsage, sequelize } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op } = require('sequelize');

/**
 * List all coupons with stats, search & filters
 */
exports.listCoupons = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const where = {};
    if (status === 'active') {
      where.is_active = true;
    } else if (status === 'inactive') {
      where.is_active = false;
    }

    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search.trim()}%` } },
        { title: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const { rows: coupons, count: total } = await Coupon.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Compute stats
    const totalCount = await Coupon.count();
    const activeCount = await Coupon.count({ where: { is_active: true } });
    const totalRedemptions = await CouponUsage.count();
    const totalBenefitGiven = await CouponUsage.sum('benefit_amount') || 0;

    return success(res, {
      coupons,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats: {
        total_coupons: totalCount,
        active_coupons: activeCount,
        total_redemptions: totalRedemptions,
        total_benefit_given: parseFloat(totalBenefitGiven).toFixed(2),
      },
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Create a new coupon code
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      benefit_type = 'bonus_credit',
      discount_type = 'percentage',
      discount_value,
      min_recharge_amount = 0,
      max_discount_amount,
      valid_from,
      valid_until,
      usage_limit_total,
      usage_limit_per_user = 1,
      is_active = true,
    } = req.body;

    if (!code || !title || discount_value === undefined || discount_value === null) {
      return error(res, { code: 'BAD_REQUEST', message: 'Code, title, and discount/bonus value are required.' }, 400);
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Check code uniqueness
    const existing = await Coupon.findOne({ where: { code: cleanCode } });
    if (existing) {
      return error(res, { code: 'CONFLICT', message: `A coupon with code "${cleanCode}" already exists.` }, 409);
    }

    const numValue = parseFloat(discount_value);
    if (isNaN(numValue) || numValue <= 0) {
      return error(res, { code: 'BAD_REQUEST', message: 'Value must be greater than zero.' }, 400);
    }

    if (discount_type === 'percentage' && numValue > 100) {
      return error(res, { code: 'BAD_REQUEST', message: 'Percentage discount cannot exceed 100%.' }, 400);
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      title: title.trim(),
      description: description ? description.trim() : null,
      benefit_type,
      discount_type,
      discount_value: numValue,
      min_recharge_amount: parseFloat(min_recharge_amount) || 0,
      max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_until: valid_until ? new Date(valid_until) : null,
      usage_limit_total: usage_limit_total ? parseInt(usage_limit_total) : null,
      usage_limit_per_user: parseInt(usage_limit_per_user) || 1,
      is_active: Boolean(is_active),
    });

    return success(res, coupon, 201);
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Get coupon details & recent redemptions
 */
exports.getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return error(res, { code: 'NOT_FOUND', message: 'Coupon not found.' }, 404);
    }

    const recentUsages = await CouponUsage.findAll({
      where: { coupon_id: id },
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    return success(res, { coupon, recent_usages: recentUsages });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Update an existing coupon
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return error(res, { code: 'NOT_FOUND', message: 'Coupon not found.' }, 404);
    }

    const {
      code,
      title,
      description,
      benefit_type,
      discount_type,
      discount_value,
      min_recharge_amount,
      max_discount_amount,
      valid_from,
      valid_until,
      usage_limit_total,
      usage_limit_per_user,
      is_active,
    } = req.body;

    if (code) {
      const cleanCode = String(code).trim().toUpperCase();
      if (cleanCode !== coupon.code) {
        const existing = await Coupon.findOne({ where: { code: cleanCode } });
        if (existing) {
          return error(res, { code: 'CONFLICT', message: `Code "${cleanCode}" is already taken by another coupon.` }, 409);
        }
        coupon.code = cleanCode;
      }
    }

    if (title !== undefined) coupon.title = title.trim();
    if (description !== undefined) coupon.description = description ? description.trim() : null;
    if (benefit_type !== undefined) coupon.benefit_type = benefit_type;
    if (discount_type !== undefined) coupon.discount_type = discount_type;

    if (discount_value !== undefined) {
      const numValue = parseFloat(discount_value);
      if (isNaN(numValue) || numValue <= 0) {
        return error(res, { code: 'BAD_REQUEST', message: 'Value must be greater than zero.' }, 400);
      }
      coupon.discount_value = numValue;
    }

    if (min_recharge_amount !== undefined) coupon.min_recharge_amount = parseFloat(min_recharge_amount) || 0;
    if (max_discount_amount !== undefined) coupon.max_discount_amount = max_discount_amount ? parseFloat(max_discount_amount) : null;
    if (valid_from !== undefined) coupon.valid_from = valid_from ? new Date(valid_from) : null;
    if (valid_until !== undefined) coupon.valid_until = valid_until ? new Date(valid_until) : null;
    if (usage_limit_total !== undefined) coupon.usage_limit_total = usage_limit_total ? parseInt(usage_limit_total) : null;
    if (usage_limit_per_user !== undefined) coupon.usage_limit_per_user = parseInt(usage_limit_per_user) || 1;
    if (is_active !== undefined) coupon.is_active = Boolean(is_active);

    await coupon.save();

    return success(res, coupon);
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Toggle coupon active status
 */
exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return error(res, { code: 'NOT_FOUND', message: 'Coupon not found.' }, 404);
    }

    coupon.is_active = !coupon.is_active;
    await coupon.save();

    return success(res, {
      id: coupon.id,
      code: coupon.code,
      is_active: coupon.is_active,
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Delete a coupon
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return error(res, { code: 'NOT_FOUND', message: 'Coupon not found.' }, 404);
    }

    await coupon.destroy();
    return success(res, { deleted: true, id });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};
