'use strict';

const { 
  sequelize, 
  Tenant, 
  TenantSubscription, 
  SubscriptionPlan, 
  CourierProvider,
  Invoice
} = require('../models');
const analyticsQueryRepository = require('../repositories/analyticsQuery.repository');
const { Op } = require('sequelize');

// Load Queues
const webhookProcessQueue = require('../queues/webhookProcess.queue');
const ndrDetectionQueue = require('../queues/ndrDetection.queue');
const trackingPollQueue = require('../queues/trackingPoll.queue');
const { planRenewalQueue } = require('../schedulers/planRenewalScheduler');
const { monthlyStatementQueue } = require('../schedulers/monthlyStatementScheduler');
const { notificationDispatchQueue } = require('../queue/queues/notificationDispatch.queue');
const { webhookDeliveryQueue } = require('../queue/queues/webhookDelivery.queue');

/**
 * Calculates current Monthly Recurring Revenue (MRR).
 */
async function calculateMRR() {
  const activeSubs = await TenantSubscription.findAll({
    where: {
      status: ['active', 'grace_period'],
    },
    include: [
      {
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['price_monthly', 'price_yearly'],
      },
    ],
  });

  let totalMRR = 0.0;
  activeSubs.forEach((sub) => {
    if (!sub.plan) return;
    
    const priceMonthly = parseFloat(sub.plan.price_monthly) || 0.0;
    const priceYearly = parseFloat(sub.plan.price_yearly) || 0.0;

    if (sub.billing_cycle === 'yearly' && priceYearly > 0) {
      totalMRR += priceYearly / 12.0;
    } else {
      totalMRR += priceMonthly;
    }
  });

  return parseFloat(totalMRR.toFixed(2));
}

/**
 * Platform Revenue Overview: MRR, total revenue, trend.
 */
async function getRevenueOverview(period = 'monthly', months = 6) {
  const current_mrr = await calculateMRR();

  // Get total invoices trend
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);
  const dateFromStr = dateFrom.toISOString().substring(0, 10);
  const dateToStr = new Date().toISOString().substring(0, 10);

  const metrics = await analyticsQueryRepository.getMetrics(
    analyticsQueryRepository.SENTINEL_PLATFORM_UUID,
    dateFromStr,
    dateToStr
  );

  // Group by month YYYY-MM
  const monthlyTrend = {};
  metrics.forEach((row) => {
    const month = row.date.substring(0, 7);
    if (!monthlyTrend[month]) {
      monthlyTrend[month] = { month, revenue: 0.0 };
    }
    // Sum platform-wide invoiced revenue
    monthlyTrend[month].revenue += row.revenue_amount || 0.0;
  });

  const trend = Object.values(monthlyTrend).sort((a, b) => a.month.localeCompare(b.month));

  return {
    current_mrr,
    trend,
  };
}

/**
 * Platform Revenue By Subscription Plan.
 */
async function getRevenueByPlan() {
  const activeSubs = await TenantSubscription.findAll({
    where: {
      status: ['active', 'grace_period'],
    },
    include: [
      {
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['name', 'slug', 'price_monthly', 'price_yearly'],
      },
    ],
  });

  const planBreakdown = {};

  activeSubs.forEach((sub) => {
    if (!sub.plan) return;
    const planName = sub.plan.name;
    if (!planBreakdown[planName]) {
      planBreakdown[planName] = {
        plan_name: planName,
        active_count: 0,
        mrr: 0.0,
      };
    }

    const priceMonthly = parseFloat(sub.plan.price_monthly) || 0.0;
    const priceYearly = parseFloat(sub.plan.price_yearly) || 0.0;

    let subMRR = priceMonthly;
    if (sub.billing_cycle === 'yearly' && priceYearly > 0) {
      subMRR = priceYearly / 12.0;
    }

    planBreakdown[planName].active_count += 1;
    planBreakdown[planName].mrr += subMRR;
  });

  // Convert breakdown values to list and format
  return Object.values(planBreakdown).map((item) => ({
    plan_name: item.plan_name,
    active_count: item.active_count,
    mrr: parseFloat(item.mrr.toFixed(2)),
  }));
}

/**
 * Platform Tenant Growth Analytics (signups and status breakdown).
 */
async function getTenantGrowth(months = 6) {
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);

  // Signups count grouped by month
  const isPostgres = sequelize.getDialect() === 'postgres';
  const monthExpr = isPostgres 
    ? sequelize.fn('TO_CHAR', sequelize.col('created_at'), 'YYYY-MM')
    : sequelize.fn('strftime', '%Y-%m', sequelize.col('created_at'));

  const signups = await Tenant.findAll({
    attributes: [
      [monthExpr, 'month'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      created_at: {
        [Op.gte]: dateFrom,
      },
    },
    group: [monthExpr],
    raw: true,
  });

  const signupTrend = signups.map((s) => ({
    month: s.month,
    signups: parseInt(s.count, 10),
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Current statuses distributions
  const statuses = await TenantSubscription.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });

  const status_breakdown = {
    active: 0,
    grace_period: 0,
    suspended: 0,
    cancelled: 0,
  };

  statuses.forEach((s) => {
    if (status_breakdown[s.status] !== undefined) {
      status_breakdown[s.status] = parseInt(s.count, 10);
    }
  });

  return {
    signup_trend: signupTrend,
    status_breakdown,
  };
}

/**
 * Top tenants by volume/revenue.
 */
async function getTopTenants(sortBy = 'volume', limit = 20) {
  const cleanLimit = Math.min(Math.max(limit, 1), 100);
  return analyticsQueryRepository.getTopTenants({ sort_by: sortBy, limit: cleanLimit });
}

/**
 * Cross-tenant Courier Performance Overview.
 */
async function getCourierOverview(dateFrom, dateTo) {
  return analyticsQueryRepository.getCourierPerformance(
    analyticsQueryRepository.SENTINEL_PLATFORM_UUID,
    dateFrom,
    dateTo
  );
}

/**
 * System health panel.
 */
async function getSystemHealth() {
  const queues = [
    { name: 'webhook-process', queue: webhookProcessQueue },
    { name: 'ndr-detection', queue: ndrDetectionQueue },
    { name: 'tracking-poll', queue: trackingPollQueue },
    { name: 'plan-renewal', queue: planRenewalQueue },
    { name: 'monthly-statement', queue: monthlyStatementQueue },
    { name: 'notification-dispatch', queue: notificationDispatchQueue },
    { name: 'webhook-delivery', queue: webhookDeliveryQueue },
  ];

  const queueHealth = await Promise.all(
    queues.map(async ({ name, queue }) => {
      try {
        const [waiting, active, failed, completed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
          queue.getCompletedCount(),
          queue.getDelayedCount(),
        ]);
        return {
          queue_name: name,
          waiting_count: waiting,
          active_count: active,
          failed_count: failed,
          completed_count: completed,
          delayed_count: delayed,
        };
      } catch (err) {
        return {
          queue_name: name,
          error: err.message,
        };
      }
    })
  );

  // Fetch circuit breaker states from database
  const couriers = await CourierProvider.findAll({
    attributes: ['id', 'provider_key', 'display_name', 'circuit_breaker_state', 'consecutive_failures', 'is_active'],
  });

  return {
    queues: queueHealth,
    couriers: couriers.map((c) => ({
      provider_id: c.id,
      provider_key: c.provider_key,
      display_name: c.display_name,
      is_active: c.is_active,
      circuit_breaker_state: c.circuit_breaker_state,
      consecutive_failures: c.consecutive_failures,
    })),
  };
}

module.exports = {
  getRevenueOverview,
  getRevenueByPlan,
  getTenantGrowth,
  getTopTenants,
  getCourierOverview,
  getSystemHealth,
};
