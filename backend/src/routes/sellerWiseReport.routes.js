'use strict';

const express = require('express');
const router = express.Router();
const sellerWiseReportController = require('../controllers/sellerWiseReport.controller');
const platformIntegrationController = require('../controllers/platformIntegration.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

// Seller-wise Summary for platform admin toggle views & merchant accounts list
router.get('/orders/seller-summary', isPlatformAdmin, sellerWiseReportController.getSellerSummary);
router.get('/sellers', isPlatformAdmin, sellerWiseReportController.getSellerSummary);

// Reports
router.get('/reports/customer-database', isPlatformAdmin, platformIntegrationController.getCustomerDatabaseReport);
router.get('/reports/customer-logistics', isPlatformAdmin, platformIntegrationController.getCustomerLogisticsReport);

module.exports = router;
