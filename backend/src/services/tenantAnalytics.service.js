'use strict';

const { sequelize } = require('../models');
const analyticsQueryRepository = require('../repositories/analyticsQuery.repository');

/**
 * Aggregates daily metrics list into granularity: daily, weekly, monthly
 */
function aggregateGranularity(metrics, granularity) {
  if (granularity === 'daily') {
    return metrics;
  }

  const grouped = {};

  metrics.forEach((row) => {
    let key;
    if (granularity === 'weekly') {
      // Find Monday of the week strictly in UTC to prevent timezone boundary shifts (Fix #23)
      const [year, month, dayOfMonth] = row.date.substring(0, 10).split('-').map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, dayOfMonth));
      const utcDay = utcDate.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
      const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
      utcDate.setUTCDate(utcDate.getUTCDate() + diffDays);
      key = utcDate.toISOString().substring(0, 10);
    } else {
      // monthly
      key = row.date.substring(0, 7); // YYYY-MM
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        orders_count: 0,
        shipments_count: 0,
        delivered_count: 0,
        ndr_count: 0,
        rto_count: 0,
        cod_amount: 0.0,
        prepaid_amount: 0.0,
        shipping_spend: 0.0,
      };
    }

    grouped[key].orders_count += row.orders_count;
    grouped[key].shipments_count += row.shipments_count;
    grouped[key].delivered_count += row.delivered_count;
    grouped[key].ndr_count += row.ndr_count;
    grouped[key].rto_count += row.rto_count;
    grouped[key].cod_amount += row.cod_amount;
    grouped[key].prepaid_amount += row.prepaid_amount;
    grouped[key].shipping_spend += row.shipping_spend;
  });

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

async function getOverview(tenantId, dateFrom, dateTo) {
  const metrics = await analyticsQueryRepository.getMetrics(tenantId, dateFrom, dateTo);

  let orders_count = 0;
  let shipments_count = 0;
  let delivered_count = 0;
  let ndr_count = 0;
  let rto_count = 0;
  let cod_amount = 0.0;
  let prepaid_amount = 0.0;
  let shipping_spend = 0.0;

  metrics.forEach((row) => {
    orders_count += row.orders_count;
    shipments_count += row.shipments_count;
    delivered_count += row.delivered_count;
    ndr_count += row.ndr_count;
    rto_count += row.rto_count;
    cod_amount += row.cod_amount;
    prepaid_amount += row.prepaid_amount;
    shipping_spend += row.shipping_spend;
  });

  const successRateDenom = delivered_count + rto_count;
  const delivery_success_rate = successRateDenom > 0 ? (delivered_count / successRateDenom) * 100 : 0.0;

  return {
    orders_count,
    shipments_count,
    delivered_count,
    ndr_count,
    rto_count,
    delivery_success_rate: parseFloat(delivery_success_rate.toFixed(2)),
    cod_amount: parseFloat(cod_amount.toFixed(2)),
    prepaid_amount: parseFloat(prepaid_amount.toFixed(2)),
    shipping_spend: parseFloat(shipping_spend.toFixed(2)),
  };
}

async function getOrdersTrend(tenantId, dateFrom, dateTo, granularity = 'daily') {
  const metrics = await analyticsQueryRepository.getMetrics(tenantId, dateFrom, dateTo);
  return aggregateGranularity(metrics, granularity);
}

async function getCourierPerformance(tenantId, dateFrom, dateTo) {
  return analyticsQueryRepository.getCourierPerformance(tenantId, dateFrom, dateTo);
}

async function getZoneDistribution(tenantId, dateFrom, dateTo) {
  return analyticsQueryRepository.getZoneDistribution(tenantId, dateFrom, dateTo);
}

async function getPaymentSplit(tenantId, dateFrom, dateTo) {
  const metrics = await analyticsQueryRepository.getMetrics(tenantId, dateFrom, dateTo);
  let cod_count = 0;
  let prepaid_count = 0;
  let cod_amount = 0.0;
  let prepaid_amount = 0.0;

  metrics.forEach((row) => {
    cod_amount += row.cod_amount;
    prepaid_amount += row.prepaid_amount;
    // Estimate counts based on average ratios or just use spend as primary indicator
    // In a live system, we query counts directly. Let's make sure it is accurate by querying if needed
  });

  // Query actual payment counts live to match split detail requirements
  const { Order } = require('../models');
  const { Op } = require('sequelize');
  
  const countStats = await Order.findAll({
    attributes: [
      'payment_mode',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      tenant_id: tenantId,
      created_at: {
        [Op.between]: [`${dateFrom} 00:00:00.000`, `${dateTo} 23:59:59.999`]
      }
    },
    group: ['payment_mode'],
    raw: true
  });

  countStats.forEach((stat) => {
    if (stat.payment_mode === 'cod') {
      cod_count = parseInt(stat.count, 10);
    } else if (stat.payment_mode === 'prepaid') {
      prepaid_count = parseInt(stat.count, 10);
    }
  });

  const total_orders = cod_count + prepaid_count;

  return {
    cod: {
      count: cod_count,
      amount: parseFloat(cod_amount.toFixed(2)),
      percentage: total_orders > 0 ? parseFloat(((cod_count / total_orders) * 100).toFixed(2)) : 0
    },
    prepaid: {
      count: prepaid_count,
      amount: parseFloat(prepaid_amount.toFixed(2)),
      percentage: total_orders > 0 ? parseFloat(((prepaid_count / total_orders) * 100).toFixed(2)) : 0
    }
  };
}

async function getWalletSpendTrend(tenantId, dateFrom, dateTo) {
  return analyticsQueryRepository.getWalletSpendTrend(tenantId, dateFrom, dateTo);
}

async function getNdrRtoTrend(tenantId, dateFrom, dateTo, granularity = 'daily') {
  const metrics = await analyticsQueryRepository.getMetrics(tenantId, dateFrom, dateTo);
  const trend = aggregateGranularity(metrics, granularity);
  return trend.map((row) => {
    const total = row.shipments_count;
    const ndrRate = total > 0 ? (row.ndr_count / total) * 100 : 0.0;
    const rtoRate = total > 0 ? (row.rto_count / total) * 100 : 0.0;
    return {
      date: row.date,
      ndr_count: row.ndr_count,
      rto_count: row.rto_count,
      ndr_rate: parseFloat(ndrRate.toFixed(2)),
      rto_rate: parseFloat(rtoRate.toFixed(2)),
    };
  });
}

module.exports = {
  getOverview,
  getOrdersTrend,
  getCourierPerformance,
  getZoneDistribution,
  getPaymentSplit,
  getWalletSpendTrend,
  getNdrRtoTrend,
};
