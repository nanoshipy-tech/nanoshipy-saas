'use strict';

const invoiceService = require('../services/invoice.service');
const invoiceRepository = require('../repositories/invoice.repository');
const { success } = require('../utils/apiResponse');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const path = require('path');
const fs = require('fs/promises');
const config = require('../config/env');

/**
 * List tenant invoices.
 */
async function listInvoices(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { invoice_type, status, date_from, date_to, page, limit, sort, order } = req.query;

    const result = await invoiceRepository.findAll({
      tenant_id: tenantId,
      invoice_type,
      status,
      date_from,
      date_to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sort: sort || 'created_at',
      order: order || 'DESC',
    });

    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed invoice record.
 */
async function getInvoiceDetail(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const invoice = await invoiceRepository.findById(id, tenantId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return success(res, invoice);
  } catch (err) {
    next(err);
  }
}

/**
 * Stream/Download private PDF file securely.
 */
async function getInvoicePdfStream(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const invoice = await invoiceRepository.findById(id, tenantId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    let pdfBuffer = null;

    if (invoice.pdf_url) {
      if (invoice.pdf_url.startsWith('http')) {
        return res.redirect(invoice.pdf_url);
      }
      try {
        const relPath = invoice.pdf_url.replace(`/${config.storage.uploadDir}/`, '');
        const targetPath = path.join(__dirname, '..', '..', config.storage.uploadDir, relPath);
        pdfBuffer = await fs.readFile(targetPath);
      } catch (fileErr) {
        pdfBuffer = null;
      }
    }

    if (!pdfBuffer) {
      // Dynamic PDF generation fallback if missing on disk
      const invoicePdfService = require('../services/invoicePdf.service');
      const generated = await invoicePdfService.generateInvoicePdf(invoice);
      if (generated && generated.buffer) {
        pdfBuffer = generated.buffer;
      } else if (Buffer.isBuffer(generated)) {
        pdfBuffer = generated;
      } else if (generated && generated.file_path) {
        pdfBuffer = await fs.readFile(generated.file_path);
      } else {
        throw new Error('Failed to generate PDF document');
      }
    }

    const sanitizedInvoiceNum = (invoice.invoice_number || invoice.id).replace(/[/\\?%*:|"<>]/g, '-');
    const safeFilename = `invoice-${sanitizedInvoiceNum}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Trigger bulk export and merge of invoice PDFs.
 */
async function bulkExport(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { invoice_ids } = req.body;

    const result = await invoiceService.bulkExportInvoices(tenantId, invoice_ids);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get dashboard spend summaries.
 */
async function getSummary(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const summary = await invoiceService.getBillingSummary(tenantId);
    return success(res, summary);
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - view platform-wide invoices logs.
 */
async function getPlatformInvoices(req, res, next) {
  try {
    const { tenant_id, date_from, date_to, page, limit } = req.query;

    const result = await invoiceRepository.findAll({
      tenant_id,
      date_from,
      date_to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      sort: 'created_at',
      order: 'DESC',
    });

    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInvoices,
  getInvoiceDetail,
  getInvoicePdfStream,
  bulkExport,
  getSummary,
  getPlatformInvoices,
};
