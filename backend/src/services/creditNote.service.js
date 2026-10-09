'use strict';

const { Invoice, CreditNote, sequelize } = require('../models');
const { NotFoundError } = require('../utils/errors');
const invoiceNumberingService = require('./invoiceNumbering.service');
const fileUploadService = require('./fileUpload.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Auto-generate a credit note when a shipment is cancelled or returned to origin (RTO).
 */
async function createCancellationCreditNote(shipmentId, reason, parentTransaction = null) {
  const ownTxn = !parentTransaction;
  const t = parentTransaction || (await sequelize.transaction());

  let creditNote;

  try {
    // 1. Locate the original invoice
    const invoice = await Invoice.findOne({
      where: { reference_type: 'shipment', reference_id: shipmentId },
      transaction: t,
    });

    if (!invoice) {
      logger.info(`[CreditNoteService] Skipping credit note generation for shipment ${shipmentId}: No original invoice exists.`);
      if (ownTxn) await t.commit();
      return null;
    }

    // Idempotency: check if credit note already exists
    const existing = await CreditNote.findOne({
      where: { original_invoice_id: invoice.id },
      transaction: t,
    });

    if (existing) {
      if (ownTxn) await t.commit();
      return existing;
    }

    // 2. Allocate sequential credit note number
    const creditNoteNumber = await invoiceNumberingService.generateNextNumber('credit_note', t);

    // 3. Create credit note row
    creditNote = await CreditNote.create({
      tenant_id: invoice.tenant_id,
      original_invoice_id: invoice.id,
      credit_note_number: creditNoteNumber,
      reason,
      amount: invoice.total_amount,
      reference_type: 'shipment_cancelled',
      reference_id: shipmentId,
    }, { transaction: t });

    // 4. Audit Log
    await auditService.log({
      tenant_id: invoice.tenant_id,
      action: 'credit_note_generated',
      entity_type: 'CreditNote',
      entity_id: creditNote.id,
      metadata: { credit_note_number: creditNoteNumber, amount: invoice.total_amount },
    });

    if (ownTxn) await t.commit();
  } catch (err) {
    if (ownTxn) await t.rollback();
    logger.error(`[CreditNoteService] Failed to generate credit note for shipment ${shipmentId}: ${err.message}`);
    return null;
  }

  // 5. Generate PDF in background (Non-blocking)
  if (creditNote) {
    generateCreditNotePdf(creditNote.id).catch((pdfErr) => {
      logger.error(`[CreditNoteService] Background PDF creation failed: ${pdfErr.message}`);
    });
  }

  return creditNote;
}

/**
 * Background Credit Note PDF generator
 */
async function generateCreditNotePdf(creditNoteId) {
  const creditNote = await CreditNote.findByPk(creditNoteId, {
    include: [{ model: Invoice, as: 'originalInvoice', include: ['tenant'] }],
  });

  if (!creditNote) return;

  try {
    const pdfDoc = await PDFDocument.create();
    const width = 595.27;
    const height = 841.89;
    const page = pdfDoc.addPage([width, height]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text, x, y, size = 10, isBold = false) => {
      page.drawText(text.toString(), {
        x,
        y: height - y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const drawLine = (x1, y1, x2, y2) => {
      page.drawLine({
        start: { x: x1, y: height - y1 },
        end: { x: x2, y: height - y2 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    const config = require('../config/env');

    drawText('CREDIT NOTE', 40, 50, 18, true);

    drawText('ISSUED BY:', 40, 90, 8, true);
    drawText(config.billing.entityLegalName, 40, 105, 10, true);
    drawText(config.billing.entityAddress, 40, 120, 9);
    drawText(`GSTIN: ${creditNote.originalInvoice.billing_entity_gstin}`, 40, 135, 9, true);

    drawText(`Credit Note No: ${creditNote.credit_note_number}`, 360, 90, 10, true);
    drawText(`Date: ${new Date(creditNote.created_at).toLocaleDateString('en-IN')}`, 360, 105, 9);
    drawText(`Original Invoice: ${creditNote.originalInvoice.invoice_number}`, 360, 120, 9);

    drawLine(40, 155, 555, 155);

    drawText('RECIPIENT:', 40, 175, 8, true);
    const tenantCompanyName = creditNote.originalInvoice.tenant
      ? creditNote.originalInvoice.tenant.company_name
      : 'Valued Tenant';
    drawText(tenantCompanyName, 40, 190, 10, true);
    drawText(`GSTIN: ${creditNote.originalInvoice.tenant?.gstin || 'N/A'}`, 40, 205, 9, true);

    drawLine(40, 225, 555, 225);

    drawText('Adjustment Description', 40, 245, 9, true);
    drawText('Amount (₹)', 480, 245, 9, true);

    drawLine(40, 260, 555, 260);

    drawText(`Adjustment for cancellation. Reason: ${creditNote.reason}`, 40, 280, 9);
    drawText(parseFloat(creditNote.amount).toFixed(2), 485, 280, 9);

    drawLine(40, 305, 555, 305);

    drawText('Total Credited Value:', 350, 330, 11, true);
    drawText(`₹${parseFloat(creditNote.amount).toFixed(2)}`, 480, 330, 11, true);

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const safeNum = creditNote.credit_note_number.replace(/\//g, '-');
    const pdfUrl = await fileUploadService.uploadFile(
      pdfBuffer,
      'billing/credit-notes',
      `credit-note-${safeNum}.pdf`,
      'application/pdf'
    );

    await creditNote.update({ pdf_url: pdfUrl });
  } catch (err) {
    logger.error(`[CreditNoteService] Error generating PDF for credit note: ${err.message}`);
  }
}

module.exports = {
  createCancellationCreditNote,
  generateCreditNotePdf,
};
