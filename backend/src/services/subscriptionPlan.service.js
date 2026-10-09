'use strict';

const { SubscriptionPlan, TenantSubscription, PlanUsageTracking, PlanChangeHistory, TenantCourierAccess, CourierProvider, sequelize, User } = require('../models');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const walletService = require('./wallet.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class DowngradeLimitExceededError extends BadRequestError {
  constructor(message) {
    super(message || 'Usage exceeds target plan limits', 'DOWNGRADE_LIMIT_EXCEEDED');
  }
}

/**
 * Initializes a new tenant's subscription to the default (Free) plan.
 */
async function initializeTenantSubscription(tenantId, transaction) {
  // Find default plan
  const defaultPlan = await SubscriptionPlan.findOne({
    where: { is_default: true },
    transaction,
  });

  if (!defaultPlan) {
    throw new NotFoundError('System default subscription plan not found');
  }

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1); // 1 month period

  // Create subscription
  const sub = await TenantSubscription.create({
    tenant_id: tenantId,
    plan_id: defaultPlan.id,
    status: 'active',
    billing_cycle: 'monthly',
    current_period_start: start,
    current_period_end: end,
    auto_renew: true,
  }, { transaction });

  // Initialize tracking
  await PlanUsageTracking.create({
    tenant_id: tenantId,
    period_start: start,
    period_end: end,
    orders_count: 0,
    users_count: 1, // The initial registering user count
  }, { transaction });

  // Sync courier access tier
  await syncCourierAccess(tenantId, defaultPlan.courier_access_tier, transaction);

  // Log change history
  await PlanChangeHistory.create({
    tenant_id: tenantId,
    old_plan_id: null,
    new_plan_id: defaultPlan.id,
    change_type: 'initial',
    changed_by: null,
  }, { transaction });

  logger.info(`[SubscriptionService] Initialized subscription to default plan (${defaultPlan.name}) for tenant ${tenantId}`);
  return sub;
}

/**
 * Changes a tenant's subscription plan. Handles proration upgrades immediately and schedules downgrades.
 */
async function changeSubscription(tenantId, newPlanId, billingCycle = 'monthly', userId = null) {
  return sequelize.transaction(async (t) => {
    // 1. Fetch current subscription and new plan
    const sub = await TenantSubscription.findOne({
      where: { tenant_id: tenantId },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!sub) {
      throw new NotFoundError('Active subscription not found for tenant');
    }

    const oldPlan = sub.plan;
    const newPlan = await SubscriptionPlan.findByPk(newPlanId, { transaction: t });
    if (!newPlan) {
      throw new NotFoundError('Selected subscription plan not found');
    }

    // Determine prices
    const oldPrice = sub.billing_cycle === 'yearly' && oldPlan.price_yearly !== null ? oldPlan.price_yearly : oldPlan.price_monthly;
    const newPrice = billingCycle === 'yearly' && newPlan.price_yearly !== null ? newPlan.price_yearly : newPlan.price_monthly;

    const isUpgrade = newPrice > oldPrice;

    if (isUpgrade) {
      // UPGRADE: Apply immediately with proration using exact calendar cycle days
      const prorationResult = calculateProration({
        currentPlan: oldPlan,
        newPlan,
        cycleStartDate: sub.current_period_start,
        cycleEndDate: sub.current_period_end,
        changeDate: new Date(),
        billingCycle,
      });

      const totalDays = prorationResult.total_days;
      const daysRemaining = prorationResult.days_remaining;
      const proratedCharge = prorationResult.net_payable;

      logger.info(`[SubscriptionService] Upgrading tenant ${tenantId} to ${newPlan.name}. Total days: ${totalDays}, remaining: ${daysRemaining}, old price: ${oldPrice}, new price: ${newPrice}, charge: ${proratedCharge}`);

      // Debit from wallet
      if (proratedCharge > 0) {
        await walletService.debit(
          tenantId,
          proratedCharge,
          'subscription_debit',
          newPlan.id,
          `Prorated upgrade charge to ${newPlan.name} (${newPlan.courier_access_tier} access)`,
          userId,
          t
        );
      }

      // Apply upgrades immediately
      await sub.update({
        plan_id: newPlan.id,
        billing_cycle: billingCycle,
        status: 'active',
        grace_period_ends_at: null,
        pending_plan_id: null, // Clear any pending downgrade
      }, { transaction: t });

      // Sync courier access tier
      await syncCourierAccess(tenantId, newPlan.courier_access_tier, t);

      // Audit and log change history
      await PlanChangeHistory.create({
        tenant_id: tenantId,
        old_plan_id: oldPlan.id,
        new_plan_id: newPlan.id,
        change_type: 'upgrade',
        changed_by: userId,
      }, { transaction: t });

      await auditService.log({
        tenant_id: tenantId,
        action: 'subscription_changed',
        entity_type: 'TenantSubscription',
        entity_id: sub.id,
        metadata: { new_plan: newPlan.name, type: 'upgrade', charge: proratedCharge },
      }, t);

      return {
        new_plan: newPlan.name,
        effective: 'immediate',
        prorated_charge: proratedCharge,
      };

    } else {
      // DOWNGRADE: Check limits first, then schedule for next cycle renewal
      const tracking = await PlanUsageTracking.findOne({
        where: {
          tenant_id: tenantId,
          period_start: sub.current_period_start,
        },
        transaction: t,
      });

      const currentOrders = tracking ? tracking.orders_count : 0;
      const currentUsers = tracking ? tracking.users_count : 0;

      // Verify limits
      if (newPlan.max_orders_per_month !== null && currentOrders > newPlan.max_orders_per_month) {
        throw new DowngradeLimitExceededError(`Current order usage (${currentOrders}) exceeds target plan limit (${newPlan.max_orders_per_month}).`);
      }

      if (newPlan.max_users !== null && currentUsers > newPlan.max_users) {
        throw new DowngradeLimitExceededError(`Current seat count (${currentUsers}) exceeds target plan limit (${newPlan.max_users}).`);
      }

      // Schedule downgrade by setting pending_plan_id
      await sub.update({
        pending_plan_id: newPlan.id,
      }, { transaction: t });

      await PlanChangeHistory.create({
        tenant_id: tenantId,
        old_plan_id: oldPlan.id,
        new_plan_id: newPlan.id,
        change_type: 'downgrade',
        changed_by: userId,
      }, { transaction: t });

      await auditService.log({
        tenant_id: tenantId,
        action: 'subscription_changed',
        entity_type: 'TenantSubscription',
        entity_id: sub.id,
        metadata: { new_plan: newPlan.name, type: 'downgrade_scheduled' },
      }, t);

      return {
        new_plan: newPlan.name,
        effective: 'deferred',
        prorated_charge: 0,
      };
    }
  });
}

/**
 * Synchronizes courier access mapping based on new courier tier.
 */
async function syncCourierAccess(tenantId, courierAccessTier, transaction) {
  const providers = await CourierProvider.findAll({ transaction });
  
  for (const prov of providers) {
    const minTier = prov.min_plan_tier || 'basic';
    const isEligible = (courierAccessTier === 'all') ||
      (courierAccessTier === 'standard' && (minTier === 'basic' || minTier === 'standard')) ||
      (courierAccessTier === 'basic' && minTier === 'basic');

    if (isEligible) {
      // Find or create access row
      await TenantCourierAccess.findOrCreate({
        where: { tenant_id: tenantId, courier_provider_id: prov.id },
        defaults: { tenant_id: tenantId, courier_provider_id: prov.id },
        transaction,
      });
    } else {
      // Revoke access
      await TenantCourierAccess.destroy({
        where: { tenant_id: tenantId, courier_provider_id: prov.id },
        transaction,
      });
    }
  }
}

/**
 * Helper to calculate exact days in a given calendar month (e.g., Feb 28/29, Mar 31, Apr 30)
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function calculateProration({ currentPlan, newPlan, cycleStartDate, cycleEndDate, changeDate = new Date(), billingCycle = 'monthly' }) {
  const change = new Date(changeDate);
  let start = cycleStartDate ? new Date(cycleStartDate) : null;
  let end = cycleEndDate ? new Date(cycleEndDate) : null;

  // If cycle boundaries are missing or invalid, resolve using the exact days of the current calendar cycle month
  if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime()) || end <= start) {
    const year = change.getFullYear();
    const month = change.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    start = new Date(year, month, 1);
    end = new Date(year, month, daysInMonth, 23, 59, 59, 999);
  }

  // Calculate actual total days and remaining days dynamically
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.min(totalDays, Math.round((end - change) / (1000 * 60 * 60 * 24))));

  const currentPrice = billingCycle === 'yearly' && currentPlan.price_yearly !== null ? currentPlan.price_yearly : (currentPlan.price_monthly || 0);
  const newPrice = billingCycle === 'yearly' && newPlan.price_yearly !== null ? newPlan.price_yearly : (newPlan.price_monthly || 0);

  const unusedCredit = Math.round((currentPrice * (daysRemaining / totalDays)) * 100) / 100;
  const newPlanCharge = Math.round((newPrice * (daysRemaining / totalDays)) * 100) / 100;
  const netPayable = Math.max(0, Math.round((newPlanCharge - unusedCredit) * 100) / 100);

  return {
    total_days: totalDays,
    days_remaining: daysRemaining,
    unused_credit: unusedCredit,
    unused_credit_paise: Math.round(unusedCredit * 100),
    new_plan_charge: newPlanCharge,
    new_plan_charge_paise: Math.round(newPlanCharge * 100),
    net_payable: netPayable,
    net_payable_paise: Math.round(netPayable * 100),
  };
}

module.exports = {
  initializeTenantSubscription,
  changeSubscription,
  syncCourierAccess,
  calculateProration,
  getDaysInMonth,
  DowngradeLimitExceededError,
};
