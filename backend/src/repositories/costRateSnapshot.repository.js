'use strict';

const { CostRateSnapshot, CourierProvider, Shipment } = require('../models');
const { Op } = require('sequelize');

function round2(num) {
  return Math.round((parseFloat(num) || 0) * 100) / 100;
}

async function createSnapshot(data) {
  return CostRateSnapshot.create(data);
}

async function getMarginReport(filters = {}) {
  const { date_from, date_to, courier_id } = filters;

  const where = {};
  if (date_from || date_to) {
    where.captured_at = {};
    if (date_from) where.captured_at[Op.gte] = new Date(date_from);
    if (date_to) where.captured_at[Op.lte] = new Date(date_to);
  }
  if (courier_id) {
    where.courier_provider_id = courier_id;
  }

  const snapshots = await CostRateSnapshot.findAll({
    where,
    include: [
      { model: CourierProvider, as: 'provider', attributes: ['id', 'display_name', 'provider_key'] },
      { model: Shipment, as: 'shipment', attributes: ['id', 'cod_charge', 'status'] },
    ],
    order: [['captured_at', 'DESC']],
  });

  let totalSell = 0;
  let totalCost = 0;
  let codMargin = 0;
  let rtoMargin = 0;
  const courierMap = {};

  for (const s of snapshots) {
    const sell = parseFloat(s.sell_price) || 0;
    const cost = parseFloat(s.cost_price) || 0;
    totalSell += sell;
    totalCost += cost;

    if (s.shipment && s.shipment.cod_charge) {
      codMargin += parseFloat(s.shipment.cod_charge) || 0;
    }

    if (s.shipment && s.shipment.status === 'rto') {
      rtoMargin += (sell * 0.05); // 5% RTO surcharge component
    }

    const courierKey = s.provider ? s.provider.display_name : 'Other Courier';
    if (!courierMap[courierKey]) {
      courierMap[courierKey] = { sell: 0, cost: 0, margin: 0 };
    }
    courierMap[courierKey].sell += sell;
    courierMap[courierKey].cost += cost;
    courierMap[courierKey].margin += (sell - cost);
  }

  const totalMargin = totalSell - totalCost;
  const shippingMarginPercent = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

  const byCourier = Object.entries(courierMap).map(([courier, data]) => ({
    courier,
    sell: round2(data.sell),
    cost: round2(data.cost),
    margin: round2(data.margin),
    margin_percent: data.sell > 0 ? round2((data.margin / data.sell) * 100) : 0,
  }));

  return {
    total_sell: round2(totalSell),
    total_sell_revenue: round2(totalSell),
    total_cost: round2(totalCost),
    total_margin: round2(totalMargin),
    shipping_margin_percent: round2(shippingMarginPercent),
    margin_percent: round2(shippingMarginPercent),
    cod_margin: round2(codMargin),
    rto_margin: round2(rtoMargin),
    by_courier: byCourier,
  };
}

module.exports = {
  createSnapshot,
  getMarginReport,
};
