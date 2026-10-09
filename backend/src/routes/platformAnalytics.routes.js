'use strict';

const express = require('express');
const platformAnalyticsController = require('../controllers/platformAnalytics.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

const router = express.Router();

router.use(isPlatformAdmin);
router.use(canPlatform('report.view'));

router.get('/revenue', platformAnalyticsController.getRevenue);
router.get('/revenue-by-plan', platformAnalyticsController.getRevenueByPlan);
router.get('/tenant-growth', platformAnalyticsController.getTenantGrowth);
router.get('/top-tenants', platformAnalyticsController.getTopTenants);
router.get('/courier-overview', platformAnalyticsController.getCourierOverview);
router.get('/system-health', platformAnalyticsController.getSystemHealth);
router.get('/website-traffic', platformAnalyticsController.getWebsiteTraffic);

module.exports = router;
