'use strict';

const { TenantSubscription, SubscriptionPlan, PlanUsageTracking, User } = require('../models');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const subscriptionPlanService = require('../services/subscriptionPlan.service');

/**
 * Get tenant's current plan and usage information.
 */
async function getSubscription(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;

    let sub = await TenantSubscription.findOne({
      where: { tenant_id: tenantId },
      include: [
        { model: SubscriptionPlan, as: 'plan' },
        { model: SubscriptionPlan, as: 'pendingPlan' },
      ],
    });

    if (!sub) {
      try {
        await subscriptionPlanService.initializeTenantSubscription(tenantId);
        sub = await TenantSubscription.findOne({
          where: { tenant_id: tenantId },
          include: [
            { model: SubscriptionPlan, as: 'plan' },
            { model: SubscriptionPlan, as: 'pendingPlan' },
          ],
        });
      } catch (initErr) {
        const anyPlan = await SubscriptionPlan.findOne();
        if (anyPlan) {
          const start = new Date();
          const end = new Date();
          end.setMonth(end.getMonth() + 1);
          await TenantSubscription.create({
            tenant_id: tenantId,
            plan_id: anyPlan.id,
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: start,
            current_period_end: end,
            auto_renew: true,
          });
          sub = await TenantSubscription.findOne({
            where: { tenant_id: tenantId },
            include: [
              { model: SubscriptionPlan, as: 'plan' },
              { model: SubscriptionPlan, as: 'pendingPlan' },
            ],
          });
        }
      }
    }

    if (!sub) {
      throw new NotFoundError('No active subscription found');
    }

    // Fetch usage counts
    let tracking = await PlanUsageTracking.findOne({
      where: {
        tenant_id: tenantId,
        period_start: sub.current_period_start,
      },
    });

    const activeUsersCount = await User.count({ where: { tenant_id: tenantId } });

    const usage = {
      orders_count: tracking ? tracking.orders_count : 0,
      orders_limit: sub.plan.max_orders_per_month,
      users_count: activeUsersCount,
      users_limit: sub.plan.max_users,
      pickup_addresses_limit: sub.plan.max_pickup_addresses,
    };

    return success(res, {
      plan: sub.plan,
      pending_plan: sub.pendingPlan,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      grace_period_ends_at: sub.grace_period_ends_at,
      auto_renew: sub.auto_renew,
      usage,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List available plans for comparison.
 */
async function listTenantPlans(req, res, next) {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
    });
    return success(res, plans);
  } catch (err) {
    next(err);
  }
}

/**
 * Tenant triggers upgrade/downgrade plan.
 */
async function changePlan(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { plan_id, billing_cycle = 'monthly' } = req.body;

    const result = await subscriptionPlanService.changeSubscription(
      tenantId,
      plan_id,
      billing_cycle,
      userId
    );

    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle auto renewal status.
 */
async function toggleAutoRenew(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const sub = await TenantSubscription.findOne({ where: { tenant_id: tenantId } });

    if (!sub) {
      throw new NotFoundError('Subscription not found');
    }

    const nextState = !sub.auto_renew;
    await sub.update({ auto_renew: nextState });

    return success(res, { auto_renew: nextState, message: `Auto renewal turned ${nextState ? 'on' : 'off'}` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSubscription,
  listTenantPlans,
  changePlan,
  toggleAutoRenew,
};
