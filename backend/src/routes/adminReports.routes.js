'use strict';

const express = require('express');
const router = express.Router();
const adminReportsController = require('../controllers/adminReports.controller');
const adminOperationsReportController = require('../controllers/adminOperationsReport.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

router.get('/seller-overdue', adminReportsController.getSellerOverdueReport);
router.get('/seller-overdue/export', adminReportsController.exportSellerOverdueReport);
router.get('/amount-received', adminReportsController.getAmountReceivedReport);
router.get('/amount-received/export', adminReportsController.exportAmountReceivedReport);

// Operations Reports (District-Wise, KAM-Wise, and Master Shipments Ledger)
router.get('/operations', adminOperationsReportController.getOperationsReport);
router.get('/operations/export', adminOperationsReportController.exportOperationsReport);
router.get('/operations/filter-options', adminOperationsReportController.getFilterOptions);

module.exports = router;
