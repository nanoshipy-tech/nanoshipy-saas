'use strict';

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { thresholdSchema, manualCreditSchema } = require('../validators/recharge.validator');

// Tenant Routes (Authenticated)
router.get('/wallet', authenticate, can('wallet.view'), walletController.getWallet);
router.get('/wallet/transactions', authenticate, can('wallet.view'), walletController.listTransactions);
router.put('/wallet/threshold', authenticate, can('wallet.recharge'), validate(thresholdSchema), walletController.updateThreshold);

// Platform Admin Routes (High Privilege)
router.get('/platform/tenants/:tenantId/wallet', isPlatformAdmin, walletController.getTenantWallet);
router.post('/platform/tenants/:tenantId/wallet/credit', isPlatformAdmin, validate(manualCreditSchema), walletController.manualCreditTenant);

module.exports = router;
