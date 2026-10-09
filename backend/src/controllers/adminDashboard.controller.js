'use strict';

const { Shipment, NdrEvent, RtoRecord, Invoice, Tenant, PlatformAdmin, sequelize } = require('../models');
const { Op } = require('sequelize');
const { sendExportResponse } = require('../utils/adminExport.util');

/**
 * Returns date bounds defaulting to last 30 calendar days if omitted.
 */
function resolveDateRange(from, to) {
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const fromDate = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
    fromObj: fromDate,
    toObj: toDate,
  };
}

/**
 * Helper to get assigned seller IDs if the caller is a KeyAccountManager.
 */
async function getKamScopedTenantIds(admin) {
  if (admin && admin.role === 'key_account_manager') {
    const tenants = await Tenant.findAll({
      where: { kam_id: admin.id },
      attributes: ['id'],
      raw: true,
    });
    return tenants.map(t => t.id);
  }
  return null;
}

/**
 * GET /api/v1/admin/dashboard/shipment-summary
 */
async function getShipmentSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const range = resolveDateRange(from, to);
    const kamTenantIds = await getKamScopedTenantIds(req.platformAdmin);

    const shipmentWhere = {
      created_at: { [Op.between]: [range.fromObj, range.toObj] },
    };
    if (kamTenantIds !== null) {
      shipmentWhere.tenant_id = { [Op.in]: kamTenantIds };
    }

    const ndrWhere = {
      created_at: { [Op.between]: [range.fromObj, range.toObj] },
      status: { [Op.in]: ['open', 'action_taken'] },
    };
    if (kamTenantIds !== null) {
      ndrWhere.tenant_id = { [Op.in]: kamTenantIds };
    }

    const [deliveredCount, inTransitCount, outForDeliveryCount, rtoCount, totalCount, ndrCount] = await Promise.all([
      Shipment.count({
        where: {
          ...shipmentWhere,
          status: 'delivered',
        },
      }),
      Shipment.count({
        where: {
          ...shipmentWhere,
          status: { [Op.in]: ['in_transit', 'picked_up', 'booked', 'pickup_scheduled'] },
        },
      }),
      Shipment.count({
        where: {
          ...shipmentWhere,
          status: 'out_for_delivery',
        },
      }),
      Shipment.count({
        where: {
          ...shipmentWhere,
          status: { [Op.in]: ['rto', 'rto_in_transit', 'rto_delivered', 'rto_initiated', 'cancelled'] },
        },
      }),
      Shipment.count({
        where: shipmentWhere,
      }),
      NdrEvent.count({
        where: ndrWhere,
      }),
      Shipment.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'booked'],
          [
            sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'delivered' THEN 1 END")),
            'delivered',
          ],
        ],
        where: shipmentWhere,
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        delivered: deliveredCount,
        in_transit: inTransitCount,
        out_for_delivery: outForDeliveryCount,
        rto: rtoCount,
        ndr: ndrCount,
        total_shipments: totalCount,
        daily_histogram: dailyStats || [],
        period: {
          from: range.from,
          to: range.to,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/dashboard/shipment-summary/export
 */
async function exportShipmentSummary(req, res, next) {
  try {
    const { from, to, format = 'csv' } = req.query;
    const range = resolveDateRange(from, to);
    const kamTenantIds = await getKamScopedTenantIds(req.platformAdmin);

    const shipmentWhere = {
      created_at: { [Op.between]: [range.fromObj, range.toObj] },
    };
    if (kamTenantIds !== null) {
      shipmentWhere.tenant_id = { [Op.in]: kamTenantIds };
    }

    const shipments = await Shipment.findAll({
      where: shipmentWhere,
      include: [
        { model: Tenant, as: 'tenant', attributes: ['company_name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 10000,
    });

    const exportRows = shipments.map(s => ({
      awb_number: s.awb_number || 'PENDING',
      carrier: s.courier_provider_id || s.provider_id || 'Carrier',
      status: s.status,
      tenant_name: s.tenant?.company_name || 'N/A',
      freight_charge: s.selected_rate || 0,
      booked_at: s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : '',
    }));

    const columns = [
      { key: 'awb_number', label: 'AWB Number' },
      { key: 'carrier', label: 'Courier' },
      { key: 'status', label: 'Status' },
      { key: 'tenant_name', label: 'Seller / Merchant' },
      { key: 'freight_charge', label: 'Freight Charge (INR)' },
      { key: 'booked_at', label: 'Booked Date' },
    ];

    return sendExportResponse(res, {
      data: exportRows,
      columns,
      format,
      filename: `shipment_summary_${range.from}_to_${range.to}`,
      sheetName: 'Shipments',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Common query logic for overdue sellers.
 */
async function queryOverdueSellers({ kamId = null, callerAdmin = null } = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const effectiveKamId = (callerAdmin && callerAdmin.role === 'key_account_manager')
    ? callerAdmin.id
    : kamId;

  const tenantWhere = {};
  if (effectiveKamId) {
    tenantWhere.kam_id = effectiveKamId;
  }

  // Find all unpaid invoices whose due_date is strictly before today
  const overdueInvoices = await Invoice.findAll({
    where: {
      status: { [Op.ne]: 'paid' },
      due_date: { [Op.lt]: todayStr },
    },
    include: [
      {
        model: Tenant,
        as: 'tenant',
        where: tenantWhere,
        attributes: ['id', 'company_name', 'support_email', 'support_phone', 'state', 'kam_id'],
        include: [
          { model: PlatformAdmin, as: 'kam', attributes: ['id', 'name', 'email'] },
        ],
      },
    ],
    order: [['due_date', 'ASC']],
  });

  // Aggregate by tenant
  const sellerMap = new Map();
  let totalOverdueValue = 0;

  for (const inv of overdueInvoices) {
    const t = inv.tenant;
    if (!t) continue;

    const amt = parseFloat(inv.total_amount) || 0;
    totalOverdueValue += amt;

    if (!sellerMap.has(t.id)) {
      sellerMap.set(t.id, {
        tenant_id: t.id,
        company_name: t.company_name,
        support_email: t.support_email || '',
        support_phone: t.support_phone || '',
        state: t.state || 'N/A',
        kam_id: t.kam_id,
        kam: t.kam ? { id: t.kam.id, name: t.kam.name, email: t.kam.email } : null,
        kam_name: t.kam?.name || 'Unassigned',
        overdue_invoices_count: 0,
        total_overdue_amount: 0,
        oldest_due_date: inv.due_date,
      });
    }

    const entry = sellerMap.get(t.id);
    entry.overdue_invoices_count += 1;
    entry.total_overdue_amount = Math.round((entry.total_overdue_amount + amt) * 100) / 100;
  }

  const sellersList = Array.from(sellerMap.values()).sort(
    (a, b) => b.total_overdue_amount - a.total_overdue_amount
  );

  return {
    sellers: sellersList,
    summary: {
      total_overdue_sellers: sellersList.length,
      total_overdue_value: Math.round(totalOverdueValue * 100) / 100,
      total_overdue_amount: Math.round(totalOverdueValue * 100) / 100,
      as_of_date: todayStr,
    },
  };
}

/**
 * GET /api/v1/admin/dashboard/overdue-sellers
 */
async function getOverdueSellers(req, res, next) {
  try {
    const { kam_id } = req.query;
    const result = await queryOverdueSellers({
      kamId: kam_id || null,
      callerAdmin: req.platformAdmin,
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        overdue_sellers_count: result.summary.total_overdue_sellers,
        total_overdue_amount: result.summary.total_overdue_amount,
        sellers: result.sellers.slice(0, 50), // Top 50 in dashboard widget
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/dashboard/overdue-sellers/export
 */
async function exportOverdueSellers(req, res, next) {
  try {
    const { kam_id, format = 'csv' } = req.query;
    const result = await queryOverdueSellers({
      kamId: kam_id || null,
      callerAdmin: req.platformAdmin,
    });

    const columns = [
      { key: 'company_name', label: 'Seller Name' },
      { key: 'support_email', label: 'Email' },
      { key: 'support_phone', label: 'Phone' },
      { key: 'state', label: 'State' },
      { key: 'kam_name', label: 'Account Manager (KAM)' },
      { key: 'overdue_invoices_count', label: 'Overdue Invoices Count' },
      { key: 'total_overdue_amount', label: 'Total Overdue Amount (INR)' },
      { key: 'oldest_due_date', label: 'Oldest Due Date' },
    ];

    return sendExportResponse(res, {
      data: result.sellers,
      columns,
      format,
      filename: `overdue_sellers_${result.summary.as_of_date}`,
      sheetName: 'Overdue Sellers',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getShipmentSummary,
  exportShipmentSummary,
  getOverdueSellers,
  exportOverdueSellers,
  queryOverdueSellers,
};
