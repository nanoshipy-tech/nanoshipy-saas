'use strict';

const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { bulkExportSchema } = require('../validators/invoice.validator');

// Tenant Routes (Authenticated)
router.get('/invoices', authenticate, can('billing.view'), invoiceController.listInvoices);

// Monthly statement rollup convenience endpoint (mounted before /invoices/:id)
router.get('/invoices/statements', authenticate, can('billing.view'), (req, res, next) => {
  req.query.invoice_type = 'monthly_statement';
  invoiceController.listInvoices(req, res, next);
});
router.get('/billing/statements', authenticate, can('billing.view'), (req, res, next) => {
  req.query.invoice_type = 'monthly_statement';
  invoiceController.listInvoices(req, res, next);
});

router.get('/invoices/:id', authenticate, can('billing.view'), invoiceController.getInvoiceDetail);
router.get('/invoices/:id/pdf', authenticate, can('billing.view'), invoiceController.getInvoicePdfStream);
router.post('/invoices/bulk-export', authenticate, can('billing.view'), validate(bulkExportSchema), invoiceController.bulkExport);

// Spend / spend widgets summary statistics
router.get('/billing/summary', authenticate, can('billing.view'), invoiceController.getSummary);

// Platform Admin Routes (High Privilege)
router.get('/platform/invoices', isPlatformAdmin, invoiceController.getPlatformInvoices);

module.exports = router;
