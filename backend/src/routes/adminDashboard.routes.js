'use strict';

const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboard.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

router.get('/shipment-summary', adminDashboardController.getShipmentSummary);
router.get('/shipment-summary/export', adminDashboardController.exportShipmentSummary);
router.get('/overdue-sellers', adminDashboardController.getOverdueSellers);
router.get('/overdue-sellers/export', adminDashboardController.exportOverdueSellers);

module.exports = router;
