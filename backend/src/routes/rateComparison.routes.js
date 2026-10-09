'use strict';

const express = require('express');
const router = express.Router();
const rateComparisonController = require('../controllers/rateComparison.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

router.post(
  '/orders/:orderId/rates',
  authenticate,
  can('shipment.create'),
  rateComparisonController.compareRates
);

module.exports = router;
