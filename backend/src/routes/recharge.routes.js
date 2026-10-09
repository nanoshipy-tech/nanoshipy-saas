'use strict';

const express = require('express');
const router = express.Router();
const rechargeController = require('../controllers/recharge.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { rechargeSchema, verifySchema } = require('../validators/recharge.validator');

router.post('/wallet/recharge', authenticate, can('wallet.recharge'), validate(rechargeSchema), rechargeController.initiate);
router.post('/wallet/recharge/verify', authenticate, can('wallet.recharge'), validate(verifySchema), rechargeController.verify);

module.exports = router;
