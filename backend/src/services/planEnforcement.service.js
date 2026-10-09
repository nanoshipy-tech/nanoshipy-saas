'use strict';

const { TenantSubscription, SubscriptionPlan, PlanUsageTracking, User } = require('../models');
const { ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

class PlanLimitExceededError extends Error {
  constructor(message = 'Plan limit exceeded') {
    super(message);
    this.name = 'PlanLimitExceededError';
    this.code = 'PLAN_LIMIT_EXCEEDED';
    this.statusCode = 403;
  }
}

/**
 * Validates plan eligibility limits and active subscription states.
 */
async function checkLimit(tenantId, limitKey) {
  // 1. Fetch active subscription
  let sub = await TenantSubscription.findOne({
    where: { tenant_id: tenantId },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
  });

  if (!sub) {
    const defaultPlan = await SubscriptionPlan.findOne({ where: { is_default: true } }) || 
                        await SubscriptionPlan.findOne({ where: { is_active: true } });
    if (!defaultPlan) {
      // If no subscription plan is configured in system yet, allow order creation in dev
      return true;
    }
    sub = { status: 'active', plan: defaultPlan, current_period_start: new Date(Date.now() - 30 * 86400000), current_period_end: new Date(Date.now() + 30 * 86400000) };
  }

  // 2. Suspend checks
  if (sub.status === 'suspended') {
    throw new ForbiddenError('Your workspace subscription is suspended. Recharge your wallet to resume service.', 'SUBSCRIPTION_SUSPENDED');
  }

  const plan = sub.plan;

  // 3. Resolve current period tracking record
  let tracking = await PlanUsageTracking.findOne({
    where: {
      tenant_id: tenantId,
      period_start: sub.current_period_start,
    },
  });

  if (!tracking) {
    // Lazy initialize if missing
    tracking = await PlanUsageTracking.create({
      tenant_id: tenantId,
      period_start: sub.current_period_start,
      period_end: sub.current_period_end,
      orders_count: 0,
      users_count: 1, // Fallback default
    });
  }

  // 4. Limit Matching Checks
  if (limitKey === 'max_orders_per_month') {
    const limit = plan.max_orders_per_month;
    if (limit !== null && tracking.orders_count >= limit) {
      throw new PlanLimitExceededError(`Monthly consignment order volume cap hit (${tracking.orders_count}/${limit}). Upgrade your plan to continue dispatches.`);
    }
  }

  if (limitKey === 'max_users') {
    const limit = plan.max_users;
    // We query actual seats in database to avoid count discrepancy
    const activeSeats = await User.count({ where: { tenant_id: tenantId } });
    if (limit !== null && activeSeats >= limit) {
      throw new PlanLimitExceededError(`Workspace user seat limit reached (${activeSeats}/${limit}). Upgrade your plan to invite more team members.`);
    }
  }

  if (limitKey === 'max_pickup_addresses') {
    const limit = plan.max_pickup_addresses;
    const { PickupAddress } = require('../models');
    const addressesCount = await PickupAddress.count({ where: { tenant_id: tenantId } });
    if (limit !== null && addressesCount >= limit) {
      throw new PlanLimitExceededError(`Pickup locations limit reached (${addressesCount}/${limit}). Upgrade your plan to add more addresses.`);
    }
  }
}

/**
 * Increment billing period metrics atomically.
 */
async function incrementUsage(tenantId, limitKey, incrementAmount = 1, transaction = null) {
  // Locate active subscription period start date
  const sub = await TenantSubscription.findOne({
    where: { tenant_id: tenantId },
    transaction,
  });

  if (!sub) return;

  const tracking = await PlanUsageTracking.findOne({
    where: { tenant_id: tenantId, period_start: sub.current_period_start },
    lock: transaction ? transaction.LOCK.UPDATE : false,
    transaction,
  });

  if (tracking) {
    if (limitKey === 'max_orders_per_month') {
      await tracking.increment('orders_count', { by: incrementAmount, transaction });
    } else if (limitKey === 'max_users') {
      await tracking.increment('users_count', { by: incrementAmount, transaction });
    }
  } else {
    // Create new tracking
    await PlanUsageTracking.create({
      tenant_id: tenantId,
      period_start: sub.current_period_start,
      period_end: sub.current_period_end,
      orders_count: limitKey === 'max_orders_per_month' ? incrementAmount : 0,
      users_count: limitKey === 'max_users' ? incrementAmount : 1,
    }, { transaction });
  }
}

/**
 * Check if the tenant's plan allows access to the required courier tier
 */
async function checkCourierTier(tenantId, requiredTier = 'basic') {
  let sub = await TenantSubscription.findOne({
    where: { tenant_id: tenantId },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
  });
  if (!sub) return true;
  const currentTier = sub.plan?.courier_access_tier || 'basic';
  const tierWeight = { basic: 1, standard: 2, all: 3 };
  if ((tierWeight[currentTier] || 1) < (tierWeight[requiredTier] || 1)) {
    throw new PlanLimitExceededError(`This courier requires a ${requiredTier.toUpperCase()} plan tier. Your current plan tier is ${currentTier.toUpperCase()}.`);
  }
  return true;
}

/**
 * Get comprehensive subscription and usage summary
 */
async function getSubscriptionSummary(tenantId) {
  let sub = await TenantSubscription.findOne({
    where: { tenant_id: tenantId },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
  });
  if (!sub) {
    const defaultPlan = await SubscriptionPlan.findOne({ where: { is_default: true } }) ||
                        await SubscriptionPlan.findOne({ where: { is_active: true } });
    return {
      status: 'active',
      plan: defaultPlan,
      usage: { orders_count: 0, users_count: 1 },
    };
  }
  const tracking = await PlanUsageTracking.findOne({
    where: { tenant_id: tenantId, period_start: sub.current_period_start },
  });
  return {
    status: sub.status,
    plan: sub.plan,
    usage: {
      orders_count: tracking?.orders_count || 0,
      users_count: tracking?.users_count || 1,
      max_orders: sub.plan?.max_orders_per_month,
      max_users: sub.plan?.max_users,
    },
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
  };
}

module.exports = {
  checkLimit,
  incrementUsage,
  checkCourierTier,
  getSubscriptionSummary,
  PlanLimitExceededError,
};

