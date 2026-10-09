'use strict';

const { Invoice, InvoiceLineItem, Tenant, Shipment, sequelize } = require('../models');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const taxCalculationService = require('./taxCalculation.service');
const invoiceNumberingService = require('./invoiceNumbering.service');
const invoicePdfService = require('./invoicePdf.service');
const fileUploadService = require('./fileUpload.service');
const emailService = require('./email.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Auto-generate invoice for a successful shipment creation.
 * Scoped inside the parent transaction or its own.
 */
async function createShipmentInvoice(shipmentId, parentTransaction = null) {
  const ownTxn = !parentTransaction;
  const t = parentTransaction || (await sequelize.transaction());

  let invoice;
  let tenant;

  try {
    // 1. Fetch shipment with order and tenant
    const shipment = await Shipment.findByPk(shipmentId, {
      include: ['order', 'tenant'],
      transaction: t,
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found for invoicing');
    }

    tenant = shipment.tenant;

    // Idempotency check: see if invoice already exists
    const existing = await Invoice.findOne({
      where: { reference_type: 'shipment', reference_id: shipmentId },
      transaction: t,
    });

    if (existing) {
      if (ownTxn) await t.commit();
      return existing;
    }

    // 2. Fetch company profile / state for place of supply
    const placeOfSupply = tenant.company_state || 'Tamil Nadu'; // Default fallback

    // 3. Tax calculation
    const subtotal = parseFloat(shipment.selected_rate);
    const taxCalc = await taxCalculationService.calculateTax(
      subtotal,
      configGstin(),
      placeOfSupply,
      tenant.id
    );

    // 4. Generate sequential sequential invoice number
    const invoiceNumber = await invoiceNumberingService.generateNextNumber('invoice', t, tenant.id);

    // 5. Create Invoice row
    invoice = await Invoice.create({
      tenant_id: tenant.id,
      invoice_number: invoiceNumber,
      invoice_type: 'shipment',
      reference_type: 'shipment',
      reference_id: shipmentId,
      subtotal,
      cgst_amount: taxCalc.cgst_amount,
      sgst_amount: taxCalc.sgst_amount,
      igst_amount: taxCalc.igst_amount,
      total_amount: taxCalc.total_amount,
      status: 'paid', // Prepaid model: billing already occurred
      billing_entity_gstin: configGstin(),
      place_of_supply: placeOfSupply,
      customer_gstin: tenant.gstin || null,
      customer_legal_name: tenant.legal_name || tenant.company_name || null,
    }, { transaction: t });

    // 6. Create line item
    await InvoiceLineItem.create({
      invoice_id: invoice.id,
      description: `Shipping charges - AWB ${shipment.awb_number || 'Pending'}`,
      hsn_sac_code: '996812',
      quantity: 1,
      unit_price: subtotal,
      amount: subtotal,
    }, { transaction: t });

    // 7. Audit Log
    await auditService.log({
      tenant_id: tenant.id,
      action: 'invoice_generated',
      entity_type: 'Invoice',
      entity_id: invoice.id,
      metadata: { invoice_number: invoiceNumber, total_amount: taxCalc.total_amount },
    });

    if (ownTxn) await t.commit();
  } catch (err) {
    if (ownTxn) await t.rollback();
    logger.error(`[InvoiceService] Failed to generate database invoice for shipment ${shipmentId}: ${err.message}`);
    return null;
  }

  if (invoice) {
    generateAndDeliverPdf(invoice.id, tenant).catch((pdfErr) => {
      logger.error(`[InvoiceService] Background PDF creation or email failed: ${pdfErr.message}`);
    });
  }

  return invoice;
}

/**
 * Auto-generate GST Tax Invoice PDF for a successful Wallet Recharge.
 */
async function createRechargeInvoice(rechargeTxId, parentTransaction = null) {
  const { WalletRechargeTransaction } = require('../models');
  const ownTxn = !parentTransaction;
  const t = parentTransaction || (await sequelize.transaction());

  try {
    const tx = await WalletRechargeTransaction.findByPk(rechargeTxId, {
      include: ['tenant'],
      transaction: t,
    });

    if (!tx) throw new NotFoundError('Recharge transaction not found');

    const existing = await Invoice.findOne({
      where: { reference_type: 'wallet_recharge', reference_id: rechargeTxId },
      transaction: t,
    });

    if (existing) {
      if (ownTxn) await t.commit();
      return existing;
    }

    const tenant = tx.tenant;
    const placeOfSupply = tenant ? tenant.company_state || 'Tamil Nadu' : 'Tamil Nadu';
    const subtotal = parseFloat(tx.amount);
    const invoiceNumber = await invoiceNumberingService.generateNextNumber('recharge', t, tx.tenant_id);

    const invoice = await Invoice.create({
      tenant_id: tx.tenant_id,
      invoice_number: invoiceNumber,
      invoice_type: 'manual',
      reference_type: 'wallet_recharge',
      reference_id: rechargeTxId,
      subtotal,
      cgst_amount: 0.00,
      sgst_amount: 0.00,
      igst_amount: 0.00,
      total_amount: subtotal,
      status: 'paid',
      billing_entity_gstin: configGstin(),
      place_of_supply: placeOfSupply,
    }, { transaction: t });

    await InvoiceLineItem.create({
      invoice_id: invoice.id,
      description: `Wallet Top-Up via ${tx.gateway_name.toUpperCase()} (Payment Ref: ${tx.gateway_payment_id || tx.id})`,
      hsn_sac_code: '998311',
      quantity: 1,
      unit_price: subtotal,
      amount: subtotal,
    }, { transaction: t });

    if (ownTxn) await t.commit();

    // Render PDF asynchronously
    invoice.tenant = tenant;
    const pdfUrl = await invoicePdfService.generateInvoicePdf(invoice).catch(() => null);
    if (pdfUrl) {
      await invoice.update({ pdf_url: pdfUrl });
    }

    return invoice;
  } catch (err) {
    if (ownTxn) await t.rollback();
    logger.error(`[InvoiceService] Failed to generate wallet recharge invoice: ${err.message}`);
    return null;
  }
}

/**
 * Background PDF creation and email notifier.
 */
async function generateAndDeliverPdf(invoiceId, tenant) {
  // Reload invoice with line items
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [{ model: InvoiceLineItem, as: 'lineItems' }],
  });

  if (!invoice) return;

  // Render PDF
  invoice.tenant = tenant; // Attach tenant details
  const pdfUrl = await invoicePdfService.generateInvoicePdf(invoice);
  await invoice.update({ pdf_url: pdfUrl });

  // Get recipient email (first user or owner)
  const { User } = require('../models');
  const owner = await User.findOne({
    where: { tenant_id: tenant.id },
    order: [['created_at', 'ASC']],
  });

  if (owner) {
    await emailService.sendEmail({
      to: owner.email,
      subject: `Invoice generated for your shipment - ${invoice.invoice_number}`,
      templateName: 'invoice-generated',
      data: {
        name: owner.name,
        invoiceNumber: invoice.invoice_number,
        totalAmount: invoice.total_amount.toFixed(2),
        pdfUrl: pdfUrl,
      },
    });
  }
}

/**
 * Get Platform Billed GSTIN from environment variables.
 */
function configGstin() {
  const config = require('../config/env');
  return config.billing.entityGstin;
}

/**
 * Get dashboard spend summaries.
 */
async function getBillingSummary(tenantId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisMonthSpend = await Invoice.sum('total_amount', {
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: startOfMonth },
    },
  }) || 0;

  const pendingInvoices = await Invoice.sum('total_amount', {
    where: {
      tenant_id: tenantId,
      status: 'generated',
    },
  }) || 0;

  return {
    this_month_spend: parseFloat(thisMonthSpend),
    pending_invoices: parseFloat(pendingInvoices),
  };
}

/**
 * Bulk exports and merges invoice PDFs into a single printable file.
 */
async function bulkExportInvoices(tenantId, invoiceIds) {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new BadRequestError('Invalid or empty invoice IDs array');
  }

  if (invoiceIds.length > 200) {
    throw new BadRequestError('Bulk export limit exceeded. Maximum 200 invoices allowed.');
  }

  const invoices = await Invoice.findAll({
    where: {
      id: { [Op.in]: invoiceIds },
      tenant_id: tenantId,
    },
  });

  const axios = require('axios');
  const { PDFDocument } = require('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  let mergedCount = 0;

  for (const inv of invoices) {
    if (!inv.pdf_url) continue;

    try {
      let pdfBuffer;
      if (inv.pdf_url.startsWith('http')) {
        const res = await axios.get(inv.pdf_url, { responseType: 'arraybuffer' });
        pdfBuffer = Buffer.from(res.data);
      } else {
        // Local file system fallback
        const fs = require('fs/promises');
        const path = require('path');
        const config = require('../config/env');
        const relPath = inv.pdf_url.replace(`/${config.storage.uploadDir}/`, '');
        const targetPath = path.join(__dirname, '..', '..', config.storage.uploadDir, relPath);
        pdfBuffer = await fs.readFile(targetPath);
      }

      const doc = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      mergedCount++;
    } catch (err) {
      logger.error(`[InvoiceService] Failed to merge PDF for invoice ${inv.id}: ${err.message}`);
    }
  }

  if (mergedCount === 0) {
    throw new BadRequestError('No valid invoice PDFs were found to export');
  }

  const mergedBytes = await mergedPdf.save();
  const mergedBuffer = Buffer.from(mergedBytes);

  const mergedUrl = await fileUploadService.uploadFile(
    mergedBuffer,
    'billing/exports',
    `invoices-bulk-${Date.now()}.pdf`,
    'application/pdf'
  );

  return {
    merged_pdf_url: mergedUrl,
    count: mergedCount,
  };
}

/**
 * GST Invoice: Generate a GST-compliant invoice PDF for a freight_debit wallet transaction.
 * Called fire-and-forget from wallet.service.debit when referenceType === 'freight_debit'.
 * @param {string} txnId - WalletTransaction.id
 * @param {string} tenantId
 * @param {number} amount
 * @returns {string|null} S3 key of generated PDF
 */
async function generateFreightDebitInvoice(txnId, tenantId, amount) {
  try {
    const { WalletTransaction, Tenant } = require('../models');
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) return null;

    const txn = await WalletTransaction.findByPk(txnId);
    if (!txn) return null;

    // Build a minimal invoice object compatible with invoicePdfService
    const invoiceNumber = `FRT-${Date.now()}`;
    const tax = taxCalculationService.computeGST(amount, tenant.company_state || 'Tamil Nadu');

    const pseudoInvoice = {
      invoice_number: invoiceNumber,
      issued_at: new Date(),
      due_date: new Date(),
      subtotal: amount,
      tax_amount: tax.total,
      total_amount: amount + tax.total,
      status: 'paid',
      tenant,
      lineItems: [{
        description: `Freight charges — ${txn.description || 'Shipment booking'}`,
        quantity: 1,
        unit_price: amount,
        total: amount,
        hsn_code: '996812',
        cgst_rate: tax.cgstRate,
        sgst_rate: tax.sgstRate,
        igst_rate: tax.igstRate,
      }],
    };

    const s3Key = await invoicePdfService.generateInvoicePdf(pseudoInvoice);
    return s3Key;
  } catch (err) {
    logger.error(`[InvoiceService] generateFreightDebitInvoice failed: ${err.message}`);
    return null;
  }
}

module.exports = {
  createShipmentInvoice,
  createRechargeInvoice,
  generateAndDeliverPdf,
  getBillingSummary,
  bulkExportInvoices,
  generateFreightDebitInvoice,
};
