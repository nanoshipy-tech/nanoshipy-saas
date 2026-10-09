'use strict';

const { queryOverdueSellers } = require('./adminDashboard.controller');
const { WalletRechargeTransaction, Tenant, PlatformAdmin, sequelize } = require('../models');
const { Op } = require('sequelize');
const { sendExportResponse } = require('../utils/adminExport.util');

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
 * GET /api/v1/admin/reports/seller-overdue
 * Reconciles 100% with dashboard overdue totals.
 */
async function getSellerOverdueReport(req, res, next) {
  try {
    const { kam_id, page = 1, limit = 50 } = req.query;
    const result = await queryOverdueSellers({
      kamId: kam_id || null,
      callerAdmin: req.platformAdmin,
    });

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;
    const paginatedSellers = result.sellers.slice(offset, offset + limitNum);

    return res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        rows: paginatedSellers,
        sellers: paginatedSellers,
        pagination: {
          total: result.sellers.length,
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(result.sellers.length / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/seller-overdue/export
 */
async function exportSellerOverdueReport(req, res, next) {
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
      filename: `seller_overdue_report_${result.summary.as_of_date}`,
      sheetName: 'Seller Overdue',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Internal query helper for amount received.
 */
async function queryAmountReceived({ from, to, kamId, state, overall, callerAdmin }) {
  const range = resolveDateRange(from, to);
  const effectiveKamId = (callerAdmin && callerAdmin.role === 'key_account_manager')
    ? callerAdmin.id
    : kamId;

  const tenantWhere = {};
  if (effectiveKamId) tenantWhere.kam_id = effectiveKamId;
  if (state) tenantWhere.state = state;

  const txWhere = {
    created_at: { [Op.between]: [range.fromObj, range.toObj] },
    status: { [Op.notIn]: ['failed', 'refunded', 'reversed'] }, // Strict exclusion of refunded recharges
  };

  const transactions = await WalletRechargeTransaction.findAll({
    where: txWhere,
    include: [
      {
        model: Tenant,
        as: 'tenant',
        where: Object.keys(tenantWhere).length > 0 ? tenantWhere : undefined,
        attributes: ['id', 'company_name', 'state', 'kam_id', 'support_email'],
        include: [
          { model: PlatformAdmin, as: 'kam', attributes: ['id', 'name'] },
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: 10000,
  });

  let totalAmount = 0;
  const sellerSummaryMap = new Map();
  const rawRows = [];

  for (const tx of transactions) {
    const amt = parseFloat(tx.amount) || 0;
    totalAmount += amt;

    const t = tx.tenant;
    const sellerId = t?.id || tx.tenant_id;
    const sellerName = t?.company_name || 'Direct Merchant';
    const sellerState = t?.state || 'N/A';
    const kamName = t?.kam?.name || 'Unassigned';

    rawRows.push({
      id: tx.id,
      transaction_id: tx.id,
      order_id: tx.gateway_order_id || tx.id,
      tenant: t ? {
        id: t.id,
        company_name: t.company_name,
        state: t.state,
        support_email: t.support_email,
        kam: t.kam ? { id: t.kam.id, name: t.kam.name } : null,
      } : null,
      seller_name: sellerName,
      state: sellerState,
      kam_name: kamName,
      amount: amt,
      balance_after: tx.balance_after || 0,
      created_at: tx.created_at,
      status: tx.status,
      date: tx.created_at ? new Date(tx.created_at).toISOString().split('T')[0] : '',
    });

    if (!sellerSummaryMap.has(sellerId)) {
      sellerSummaryMap.set(sellerId, {
        seller_id: sellerId,
        company_name: sellerName,
        state: sellerState,
        kam_name: kamName,
        transaction_count: 0,
        total_amount: 0,
      });
    }

    const s = sellerSummaryMap.get(sellerId);
    s.transaction_count += 1;
    s.total_amount = Math.round((s.total_amount + amt) * 100) / 100;
  }

  return {
    summary: {
      total_amount_received: Math.round(totalAmount * 100) / 100,
      total_transactions: transactions.length,
      total_transactions_count: transactions.length,
      total_unique_tenants: sellerSummaryMap.size,
      period: { from: range.from, to: range.to },
      filter_state: state || 'All States',
      filter_kam: effectiveKamId || 'All KAMs',
    },
    sellers: Array.from(sellerSummaryMap.values()).sort((a, b) => b.total_amount - a.total_amount),
    transactions: rawRows,
  };
}

/**
 * GET /api/v1/admin/reports/amount-received
 */
async function getAmountReceivedReport(req, res, next) {
  try {
    const { from, to, kam_id, state, overall, page = 1, limit = 20 } = req.query;
    const result = await queryAmountReceived({
      from,
      to,
      kamId: kam_id || null,
      state: state || null,
      overall: overall === 'true',
      callerAdmin: req.platformAdmin,
    });

    const isOverall = overall === 'true';
    const allRows = isOverall ? result.transactions : (result.transactions.length > 0 ? result.transactions : result.sellers);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const total = allRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const paginatedRows = allRows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        transactions: paginatedRows,
        rows: paginatedRows,
        sellers: result.sellers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/amount-received/export
 */
async function exportAmountReceivedReport(req, res, next) {
  try {
    const { from, to, kam_id, state, overall, format = 'csv' } = req.query;
    const result = await queryAmountReceived({
      from,
      to,
      kamId: kam_id || null,
      state: state || null,
      overall: overall === 'true',
      callerAdmin: req.platformAdmin,
    });

    const isOverall = overall === 'true';
    let columns;
    let data;

    if (isOverall) {
      columns = [
        { key: 'order_id', label: 'Transaction / Order ID' },
        { key: 'seller_name', label: 'Seller Name' },
        { key: 'state', label: 'State' },
        { key: 'kam_name', label: 'KAM' },
        { key: 'amount', label: 'Amount Received (INR)' },
        { key: 'status', label: 'Status' },
        { key: 'date', label: 'Date' },
      ];
      data = result.transactions;
    } else {
      columns = [
        { key: 'company_name', label: 'Seller Name' },
        { key: 'state', label: 'State' },
        { key: 'kam_name', label: 'KAM' },
        { key: 'transaction_count', label: 'Total Recharges' },
        { key: 'total_amount', label: 'Total Amount Received (INR)' },
      ];
      data = result.sellers;
    }

    return sendExportResponse(res, {
      data,
      columns,
      format,
      filename: `amount_received_${result.summary.period.from}_to_${result.summary.period.to}`,
      sheetName: 'Amount Received',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSellerOverdueReport,
  exportSellerOverdueReport,
  getAmountReceivedReport,
  exportAmountReceivedReport,
};
