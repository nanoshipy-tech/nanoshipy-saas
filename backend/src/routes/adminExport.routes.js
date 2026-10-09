'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const adminExportController = require('../controllers/adminExport.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

// Rate limiter for export creation: maximum 20 exports per 15 minutes per user/IP
const exportCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    data: null,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many export requests generated. Please wait a few minutes before requesting more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

// List exportable entity catalogue
router.get('/entities', can('report.view'), adminExportController.getExportableEntities);

// Export job management
router.post('/', exportCreationLimiter, can('report.view'), adminExportController.createExport);
router.get('/', can('report.view'), adminExportController.listExports);
router.get('/:id', can('report.view'), adminExportController.getExportStatus);
router.get('/:id/download', can('report.view'), adminExportController.downloadExport);

module.exports = router;
