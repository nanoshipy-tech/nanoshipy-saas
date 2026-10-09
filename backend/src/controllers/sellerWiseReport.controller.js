'use strict';

const { Order, Shipment, Tenant, NdrEvent } = require('../models');
const { Op } = require('sequelize');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/v1/platform/orders/seller-summary
 * Returns aggregated counts per tenant for platform admin drill-down table
 */
const getSellerSummary = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({
      attributes: ['id', 'company_name', 'subdomain', 'status', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    const summaryList = await Promise.all(tenants.map(async (t) => {
      const [orders_count, shipments_count, ndr_count, rto_count] = await Promise.all([
        Order.count({ where: { tenant_id: t.id } }).catch(() => 0),
        Shipment.count({ where: { tenant_id: t.id } }).catch(() => 0),
        NdrEvent.count({ where: { tenant_id: t.id, status: { [Op.in]: ['open', 'action_taken'] } } }).catch(() => 0),
        Shipment.count({ where: { tenant_id: t.id, status: { [Op.in]: ['rto', 'rto_initiated', 'rto_in_transit', 'rto_delivered'] } } }).catch(() => 0),
      ]);

      return {
        tenant_id: t.id,
        company_name: t.company_name,
        subdomain: t.subdomain,
        status: t.status,
        orders_count,
        shipments_count,
        ndr_count,
        rto_count,
      };
    }));

    return success(res, summaryList);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSellerSummary,
};
