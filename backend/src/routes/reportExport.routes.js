'use strict';

const express = require('express');
const reportExportController = require('../controllers/reportExport.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

// Route is /reports/export
router.post('/export', authenticate, can('report.view'), reportExportController.exportReport);

// Route is /reports/download
router.get('/download', reportExportController.downloadReport);

module.exports = router;
