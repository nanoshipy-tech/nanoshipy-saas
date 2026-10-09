'use strict';

const express = require('express');
const tenantAnalyticsController = require('../controllers/tenantAnalytics.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();
const platformAnalyticsController = require('../controllers/platformAnalytics.controller');

// Public Telemetry Ingestion (Beacon / Fetch from Landing site)
router.post('/telemetry', platformAnalyticsController.ingestTelemetry);

router.use(authenticate);


router.get('/overview', can('report.view'), tenantAnalyticsController.getOverview);
router.get('/orders-trend', can('report.view'), tenantAnalyticsController.getOrdersTrend);
router.get('/courier-performance', can('report.view'), tenantAnalyticsController.getCourierPerformance);
router.get('/zone-distribution', can('report.view'), tenantAnalyticsController.getZoneDistribution);
router.get('/payment-split', can('report.view'), tenantAnalyticsController.getPaymentSplit);
router.get('/wallet-spend', can('report.view'), tenantAnalyticsController.getWalletSpend);
router.get('/ndr-rto-trend', can('report.view'), tenantAnalyticsController.getNdrRtoTrend);

module.exports = router;
