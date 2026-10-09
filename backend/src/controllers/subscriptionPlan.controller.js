'use strict';

const { SubscriptionPlan, TenantSubscription, Tenant, PlanChangeHistory, sequelize } = require('../models');
const { success } = require('../utils/apiResponse');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const subscriptionPlanService = require('../services/subscriptionPlan.service');

class CannotArchiveDefaultPlanError extends BadRequestError {
  constructor(message) {
    super(message || 'Cannot archive the default plan', 'CANNOT_ARCHIVE_DEFAULT_PLAN');
    this.statusCode = 409;
  }
}

/**
 * List all subscription plans.
 */
async function listPlans(req, res, next) {
  try {
    const { is_active } = req.query;
    const where = {};
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const plans = await SubscriptionPlan.findAll({
      where,
      order: [['sort_order', 'ASC']],
    });

    return success(res, plans);
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new plan.
 */
async function createPlan(req, res, next) {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    return success(res, plan, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Update plan details.
 */
async function updatePlan(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByPk(id);
    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    await plan.update(req.body);
    return success(res, plan);
  } catch (err) {
    next(err);
  }
}

/**
 * Archiving plans. Soft disables it (is_active = false).
 */
async function archivePlan(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByPk(id);
    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    if (plan.is_default) {
      throw new CannotArchiveDefaultPlanError('Cannot archive the system default plan. Assign a new default plan first.');
    }

    await plan.update({ is_active: false });
    return success(res, { message: 'Subscription plan archived successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - Force assign a plan (Enterprise override).
 */
async function assignPlan(req, res, next) {
  try {
    const { tenantId } = req.params;
    const { plan_id, billing_cycle = 'monthly' } = req.body;

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const plan = await SubscriptionPlan.findByPk(plan_id);
    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    let sub;
    await sequelize.transaction(async (t) => {
      sub = await TenantSubscription.findOne({
        where: { tenant_id: tenantId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      const start = new Date();
      const end = new Date();
      if (billing_cycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }

      const oldPlanId = sub ? sub.plan_id : null;

      if (sub) {
        await sub.update({
          plan_id,
          billing_cycle,
          current_period_start: start,
          current_period_end: end,
          status: 'active',
          grace_period_ends_at: null,
          pending_plan_id: null,
        }, { transaction: t });
      } else {
        sub = await TenantSubscription.create({
          tenant_id: tenantId,
          plan_id,
          billing_cycle,
          current_period_start: start,
          current_period_end: end,
          status: 'active',
        }, { transaction: t });
      }

      // Sync courier access mapping
      await subscriptionPlanService.syncCourierAccess(tenantId, plan.courier_access_tier, t);

      // Log plan changes
      await PlanChangeHistory.create({
        tenant_id: tenantId,
        old_plan_id: oldPlanId,
        new_plan_id: plan.id,
        change_type: 'initial',
        changed_by: req.user ? req.user.id : null,
      }, { transaction: t });
    });

    return success(res, { message: 'Plan successfully assigned to tenant', subscription: sub });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  archivePlan,
  assignPlan,
  CannotArchiveDefaultPlanError,
};
