'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { Tenant, Invoice, InvoiceLineItem, CreditNote, RechargeOrder, sequelize, User } = require('../models');
const taxCalculationService = require('../services/taxCalculation.service');
const invoiceNumberingService = require('../services/invoiceNumbering.service');
const invoicePdfService = require('../services/invoicePdf.service');
const emailService = require('../services/email.service');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { acquireLock, releaseLock } = require('../utils/distributedLock.util');

const LOCK_KEY = 'lock:worker:monthly-statement';
const LOCK_TTL_MS = 300000; // 5 minutes max run lock

const monthlyStatementWorker = new Worker(
  'monthly-statement',
  async (job) => {
    const acquired = await acquireLock(LOCK_KEY, LOCK_TTL_MS);
    if (!acquired) {
      logger.info('[MonthlyStatementWorker] Another worker instance is already executing monthly statements. Skipping duplicate run.');
      return { skipped: true, reason: 'LOCKED_BY_ANOTHER_INSTANCE' };
    }

    try {
      logger.info('[MonthlyStatementWorker] Starting prior-month consolidated billing statement generator...');

      // 1. Calculate start & end of previous month
      const now = new Date();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const prevMonthStartStr = prevMonthStart.toISOString().substring(0, 10);
      const prevMonthEndStr = prevMonthEnd.toISOString().substring(0, 10);

      logger.info(`[MonthlyStatementWorker] Aggregating bills for period: ${prevMonthStartStr} to ${prevMonthEndStr}`);

      // 2. Fetch all active tenants
      const tenants = await Tenant.findAll();

      for (const tenant of tenants) {
        try {
          await processTenantMonthlyStatement(tenant, prevMonthStart, prevMonthEnd);
        } catch (tenantErr) {
          logger.error(`[MonthlyStatementWorker] Failed to process monthly statement for tenant ${tenant.id}: ${tenantErr.message}`);
        }
      }
    } finally {
      await releaseLock(LOCK_KEY);
    }
  },
  {
    connection,
    concurrency: 1, // Process one tenant statement at a time to prevent server spikes
  }
);

/**
 * Aggregates prior-month spends and credits for a single tenant and issues statement invoice.
 */
async function processTenantMonthlyStatement(tenant, startDate, endDate) {
  const tenantId = tenant.id;

  // Check if a statement invoice already exists for this tenant & period
  const existingStatement = await Invoice.findOne({
    where: {
      tenant_id: tenantId,
      invoice_type: 'monthly_statement',
      billing_period_start: startDate,
      billing_period_end: endDate,
    },
  });

  if (existingStatement) {
    logger.info(`[MonthlyStatementWorker] Statement invoice already exists (${existingStatement.invoice_number}) for tenant ${tenantId} for period ${startDate.toISOString()} - skipping.`);
    return;
  }

  // 1. Sum up all shipment invoices
  const shipmentInvoices = await Invoice.findAll({
    where: {
      tenant_id: tenantId,
      invoice_type: 'shipment',
      created_at: { [Op.between]: [startDate, endDate] },
    },
  });

  // If no shipping activity and no recharges, skip statement generation
  const recharges = await RechargeOrder.findAll({
    where: {
      tenant_id: tenantId,
      status: 'success',
      created_at: { [Op.between]: [startDate, endDate] },
    },
  });

  const creditNotes = await CreditNote.findAll({
    where: {
      tenant_id: tenantId,
      created_at: { [Op.between]: [startDate, endDate] },
    },
  });

  if (shipmentInvoices.length === 0 && recharges.length === 0 && creditNotes.length === 0) {
    logger.info(`[MonthlyStatementWorker] Skipping tenant ${tenantId} - no billing activity this period.`);
    return;
  }

  // Calculate sum totals
  const shippingSubtotal = shipmentInvoices.reduce((sum, inv) => sum + parseFloat(inv.subtotal), 0);
  const totalRechargeAmt = recharges.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalRefundAmt = creditNotes.reduce((sum, cn) => sum + parseFloat(cn.amount), 0);

  // We charge standard GST split on the net shipping spend
  const billingGstin = process.env.BILLING_ENTITY_GSTIN || '33ABCDE1234F1Z5';
  const placeOfSupply = tenant.company_state || 'Tamil Nadu';
  const taxCalc = await taxCalculationService.calculateTax(shippingSubtotal, billingGstin, placeOfSupply, tenantId);

  let statementInvoice;

  // 2. Open a transaction and save statement invoice
  await sequelize.transaction(async (t) => {
    // Generate sequential statement number
    const invoiceNumber = await invoiceNumberingService.generateNextNumber('invoice', t, tenantId);

    statementInvoice = await Invoice.create({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      invoice_type: 'monthly_statement',
      reference_type: 'period',
      reference_id: null,
      billing_period_start: startDate,
      billing_period_end: endDate,
      subtotal: shippingSubtotal,
      cgst_amount: taxCalc.cgst_amount,
      sgst_amount: taxCalc.sgst_amount,
      igst_amount: taxCalc.igst_amount,
      total_amount: taxCalc.total_amount,
      status: 'paid', // Prepaid spend
      billing_entity_gstin: billingGstin,
      place_of_supply: placeOfSupply,
    }, { transaction: t });

    // Create consolidated line items
    // Shipping spend
    await InvoiceLineItem.create({
      invoice_id: statementInvoice.id,
      description: `Consolidated Shipping Spend: ${shipmentInvoices.length} consignments`,
      hsn_sac_code: '996812',
      quantity: 1,
      unit_price: shippingSubtotal,
      amount: shippingSubtotal,
    }, { transaction: t });

    // Recharges credit info
    if (totalRechargeAmt > 0) {
      await InvoiceLineItem.create({
        invoice_id: statementInvoice.id,
        description: `Informational - Consolidated Wallet Recharges`,
        hsn_sac_code: '996812',
        quantity: 1,
        unit_price: totalRechargeAmt,
        amount: totalRechargeAmt,
      }, { transaction: t });
    }

    // Credits / Refunds note
    if (totalRefundAmt > 0) {
      await InvoiceLineItem.create({
        invoice_id: statementInvoice.id,
        description: `Informational - Consolidated Credit adjustments / Refunds`,
        hsn_sac_code: '996812',
        quantity: 1,
        unit_price: -totalRefundAmt,
        amount: -totalRefundAmt,
      }, { transaction: t });
    }

    // Audit Log
    await auditService.log({
      tenant_id: tenantId,
      action: 'monthly_statement_generated',
      entity_type: 'Invoice',
      entity_id: statementInvoice.id,
      metadata: { invoice_number: invoiceNumber, total_amount: taxCalc.total_amount },
    });
  });

  // 3. Generate PDF and notify
  if (statementInvoice) {
    statementInvoice.tenant = tenant;
    const pdfUrl = await invoicePdfService.generateInvoicePdf(statementInvoice);
    await statementInvoice.update({ pdf_url: pdfUrl });

    // Send statement notification email
    const owner = await User.findOne({
      where: { tenant_id: tenant.id },
      order: [['created_at', 'ASC']],
    });

    if (owner) {
      await emailService.sendEmail({
        to: owner.email,
        subject: `Your Consolidated Monthly Statement for ${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        templateName: 'invoice-generated', // Reuse invoice-generated template for statements as well
        data: {
          name: owner.name,
          invoiceNumber: statementInvoice.invoice_number,
          totalAmount: statementInvoice.total_amount.toFixed(2),
          pdfUrl: pdfUrl,
        },
      });
    }
  }
}

// Event Listeners
monthlyStatementWorker.on('failed', (job, err) => {
  logger.error(`[MonthlyStatementWorker] Job ${job?.id} failed:`, { error: err.message });
});

monthlyStatementWorker.on('error', (err) => {
  logger.error('[MonthlyStatementWorker] Worker error:', { error: err.message });
});

module.exports = monthlyStatementWorker;
