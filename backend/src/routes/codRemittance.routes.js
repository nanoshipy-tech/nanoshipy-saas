'use strict';

const express = require('express');
const router = express.Router();
const codRemittanceController = require('../controllers/codRemittance.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

// Seller Panel routes
router.get('/wallet/cod-remittances', authenticate, codRemittanceController.listBatches);
router.get('/wallet/cod-remittances/:id', authenticate, codRemittanceController.getBatchDetails);
router.get('/wallet/remittances', authenticate, codRemittanceController.listBatches);
router.get('/wallet/remittances/:id', authenticate, codRemittanceController.getBatchDetails);

// Platform Admin / Finance routes
router.get('/platform/finance/cod-remittances', isPlatformAdmin, canPlatform('admin.view'), codRemittanceController.listBatchesAdmin);
router.post('/platform/finance/cod-remittances', isPlatformAdmin, canPlatform('platform_settings.manage'), codRemittanceController.createBatchAdmin);
router.put('/platform/finance/cod-remittances/:id/process', isPlatformAdmin, canPlatform('platform_settings.manage'), codRemittanceController.processBatchAdmin);

// Admin Panel Direct & Compatibility Aliases
router.get('/cod-remittances', isPlatformAdmin, codRemittanceController.listBatchesAdmin);
router.post('/cod-remittances/:id/remit', isPlatformAdmin, codRemittanceController.processBatchAdmin);
router.get('/cod-remittance/admin/batches', isPlatformAdmin, codRemittanceController.listBatchesAdmin);
router.post('/cod-remittance/admin/batches/:id/process', isPlatformAdmin, codRemittanceController.processBatchAdmin);

module.exports = router;
