'use strict';
const express = require('express');
const router = express.Router();
const c = require('../controllers/tenantWalletRecharge.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/config', c.getRechargeConfig);
router.get('/coupons', c.getAvailableCoupons);
router.post('/validate-coupon', c.validateCoupon);
router.post('/initiate', c.initiateRecharge);
router.post('/:id/verify', c.verifyPayment);
router.get('/history', c.getRechargeHistory);

module.exports = router;
