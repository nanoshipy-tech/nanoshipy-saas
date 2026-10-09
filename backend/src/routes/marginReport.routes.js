'use strict';

const express = require('express');
const router = express.Router();
const marginReportController = require('../controllers/marginReport.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

router.use(isPlatformAdmin);

router.get('/margin-report', canPlatform('report.view'), marginReportController.getMarginReport);

module.exports = router;
