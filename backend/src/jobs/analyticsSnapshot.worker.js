'use strict';

const { Queue, Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { getRedisClient } = require('../config/redis.config');
const { 
  sequelize, 
  Tenant, 
  AnalyticsDailySnapshot, 
  Order, 
  Shipment, 
  NdrEvent, 
  RtoRecord, 
  Invoice 
} = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

const QUEUE_NAME = 'analytics-snapshot';
const SENTINEL_PLATFORM_UUID = '00000000-0000-0000-0000-000000000000';
const FAILURE_LIMIT = 2;

// Initialize Queue
const analyticsSnapshotQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 15000,
    },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

/**
 * Computes and upserts daily snapshots for a specific date (YYYY-MM-DD format).
 */
async function runAggregationForDate(dateStr) {
  logger.info(`[AnalyticsSnapshotJob] Running pre-aggregation for date: ${dateStr}`);
  
  const start = `${dateStr} 00:00:00.000`;
  const end = `${dateStr} 23:59:59.999`;

  // Fetch all active tenants
  const tenants = await Tenant.findAll({ attributes: ['id'] });
  const tenantIds = tenants.map((t) => t.id);

  // Initialize aggregates dictionary
  const aggregates = {};
  tenantIds.forEach((tid) => {
    aggregates[tid] = {
      tenant_id: tid,
      orders_count: 0,
      shipments_count: 0,
      delivered_count: 0,
      ndr_count: 0,
      rto_count: 0,
      cod_amount: 0.0,
      prepaid_amount: 0.0,
      shipping_spend: 0.0,
      revenue_amount: null,
    };
  });

  // Aggregate orders count & payment split live
  const orders = await Order.findAll({
    attributes: [
      'tenant_id',
      'payment_mode',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('cod_amount')), 'cod_sum'],
      [sequelize.fn('SUM', sequelize.col('order_value')), 'value_sum'],
    ],
    where: {
      created_at: { [Op.between]: [start, end] },
    },
    group: ['tenant_id', 'payment_mode'],
    raw: true,
  });

  orders.forEach((o) => {
    const tid = o.tenant_id;
    if (!aggregates[tid]) return;
    const count = parseInt(o.count, 10) || 0;
    aggregates[tid].orders_count += count;

    if (o.payment_mode === 'cod') {
      aggregates[tid].cod_amount += parseFloat(o.cod_sum) || 0.0;
    } else {
      aggregates[tid].prepaid_amount += parseFloat(o.value_sum) || 0.0;
    }
  });

  // Aggregate shipments volume & spent
  const shipments = await Shipment.findAll({
    attributes: [
      'tenant_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('selected_rate')), 'spend_sum'],
    ],
    where: {
      created_at: { [Op.between]: [start, end] },
    },
    group: ['tenant_id'],
    raw: true,
  });

  shipments.forEach((s) => {
    const tid = s.tenant_id;
    if (!aggregates[tid]) return;
    aggregates[tid].shipments_count = parseInt(s.count, 10) || 0;
    aggregates[tid].shipping_spend = parseFloat(s.spend_sum) || 0.0;
  });

  // Aggregate delivered counts from history
  const delivered = await Shipment.findAll({
    attributes: [
      'tenant_id',
      [sequelize.fn('COUNT', sequelize.col('Shipment.id')), 'count'],
    ],
    include: [
      {
        model: sequelize.model('ShipmentStatusHistory'),
        as: 'statusHistories',
        attributes: [],
        where: {
          new_status: 'delivered',
          created_at: { [Op.between]: [start, end] },
        },
      },
    ],
    group: ['tenant_id'],
    raw: true,
  });

  delivered.forEach((d) => {
    const tid = d.tenant_id;
    if (!aggregates[tid]) return;
    // Map property (raw query alias)
    aggregates[tid].delivered_count = parseInt(d.count, 10) || 0;
  });

  // Aggregate NDR events
  const ndrs = await NdrEvent.findAll({
    attributes: [
      'tenant_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      created_at: { [Op.between]: [start, end] },
    },
    group: ['tenant_id'],
    raw: true,
  });

  ndrs.forEach((n) => {
    const tid = n.tenant_id;
    if (!aggregates[tid]) return;
    aggregates[tid].ndr_count = parseInt(n.count, 10) || 0;
  });

  // Aggregate RTO records
  const rtos = await RtoRecord.findAll({
    attributes: [
      'tenant_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      created_at: { [Op.between]: [start, end] },
    },
    group: ['tenant_id'],
    raw: true,
  });

  rtos.forEach((r) => {
    const tid = r.tenant_id;
    if (!aggregates[tid]) return;
    aggregates[tid].rto_count = parseInt(r.count, 10) || 0;
  });

  // Now, calculate platform-wide totals (sentinel row)
  const platformRow = {
    tenant_id: SENTINEL_PLATFORM_UUID,
    orders_count: 0,
    shipments_count: 0,
    delivered_count: 0,
    ndr_count: 0,
    rto_count: 0,
    cod_amount: 0.0,
    prepaid_amount: 0.0,
    shipping_spend: 0.0,
    revenue_amount: 0.0,
  };

  Object.values(aggregates).forEach((tRow) => {
    platformRow.orders_count += tRow.orders_count;
    platformRow.shipments_count += tRow.shipments_count;
    platformRow.delivered_count += tRow.delivered_count;
    platformRow.ndr_count += tRow.ndr_count;
    platformRow.rto_count += tRow.rto_count;
    platformRow.cod_amount += tRow.cod_amount;
    platformRow.prepaid_amount += tRow.prepaid_amount;
    platformRow.shipping_spend += tRow.shipping_spend;
  });

  // Query platform invoices total created on that day
  const invoicesSum = await Invoice.sum('total_amount', {
    where: {
      created_at: { [Op.between]: [start, end] },
    },
  });
  platformRow.revenue_amount = parseFloat(invoicesSum) || 0.0;

  // Insert all tenant aggregates + platform row
  const rowsToUpsert = [...Object.values(aggregates), platformRow];

  await sequelize.transaction(async (transaction) => {
    for (const row of rowsToUpsert) {
      await AnalyticsDailySnapshot.upsert(
        {
          tenant_id: row.tenant_id,
          snapshot_date: dateStr,
          orders_count: row.orders_count,
          shipments_count: row.shipments_count,
          delivered_count: row.delivered_count,
          ndr_count: row.ndr_count,
          rto_count: row.rto_count,
          cod_amount: row.cod_amount,
          prepaid_amount: row.prepaid_amount,
          shipping_spend: row.shipping_spend,
          revenue_amount: row.revenue_amount,
        },
        { transaction }
      );
    }
  });

  logger.info(`[AnalyticsSnapshotJob] Successfully completed nightly pre-aggregation for ${rowsToUpsert.length} rows on ${dateStr}`);
}

// Worker definition
const analyticsSnapshotWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    logger.info(`[AnalyticsSnapshotWorker] Starting execution for job ${job.id}`);
    
    // Yesterday
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - 1);
    const yesterdayStr = dateObj.toISOString().substring(0, 10);

    const redis = getRedisClient();

    try {
      await runAggregationForDate(yesterdayStr);
      
      // Clear failure counter on success
      if (redis) {
        await redis.set('analytics_snapshot_failures', 0);
      }
    } catch (err) {
      logger.error(`[AnalyticsSnapshotWorker] Nightly aggregation failed: ${err.message}`, err);

      // Increment failure count
      let failures = 1;
      if (redis) {
        failures = await redis.incr('analytics_snapshot_failures');
      }

      if (failures >= FAILURE_LIMIT) {
        logger.error(`[AnalyticsSnapshotWorker] Critical: Nightly aggregation failed for ${failures} consecutive nights. Informing platform admins.`);
        
        try {
          await emailService.sendEmail({
            to: 'admin@shippingsaas.com',
            subject: 'CRITICAL: Nightly Analytics Snapshot Failures',
            html: `
              <h2>System Alert</h2>
              <p>The nightly analytics pre-aggregation database worker (<code>analyticsSnapshot.worker.js</code>) has failed for <strong>${failures} consecutive nights</strong>.</p>
              <p><strong>Error Message:</strong> ${err.message}</p>
              <p>Please inspect system logs and check DB/Redis connectivity immediately.</p>
            `,
          });
        } catch (emailErr) {
          logger.error(`[AnalyticsSnapshotWorker] Failed to dispatch critical alert email: ${emailErr.message}`);
        }
      }

      // Re-throw so BullMQ flags it as failed
      throw err;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

/**
 * Register repeatable cron schedule (nightly at a configured hour).
 */
async function scheduleNightlySnapshots() {
  try {
    const hour = parseInt(process.env.ANALYTICS_SNAPSHOT_HOUR, 10) || 1;
    const cronExpression = `0 ${hour} * * *`;

    const jobs = await analyticsSnapshotQueue.getRepeatableJobs();
    for (const job of jobs) {
      await analyticsSnapshotQueue.removeRepeatableByKey(job.key);
    }

    await analyticsSnapshotQueue.add(
      'nightly-aggregation',
      {},
      {
        repeat: {
          pattern: cronExpression,
        },
      }
    );

    logger.info(`[AnalyticsSnapshotScheduler] Scheduled pre-aggregation cron: ${cronExpression}`);
  } catch (err) {
    logger.error('[AnalyticsSnapshotScheduler] Failed to register nightly schedule:', err);
  }
}

module.exports = {
  analyticsSnapshotQueue,
  analyticsSnapshotWorker,
  scheduleNightlySnapshots,
  runAggregationForDate, // Exposed for testing/seeding
};
