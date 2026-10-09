'use strict';

const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipment.controller');
const trackingController = require('../controllers/tracking.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { createShipmentSchema } = require('../validators/shipment.validator');
const { createLimiter } = require('../middlewares/rateLimiter.middleware');
const { requireApprovedKyc } = require('../middlewares/requireApprovedKyc.middleware');

// Rate limiter: 5 manual polls per 15 min per IP
const manualPollLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many poll requests. Please wait before refreshing tracking.' } },
  keyGenerator: (req) => `${req.ip}_${req.params.id}_poll`,
});

router.use(authenticate);

router.post(
  '/',
  can('shipment.create'),
  requireApprovedKyc,
  validate(createShipmentSchema),
  shipmentController.createShipment
);

router.post(
  '/rto',
  can('shipment.create'),
  shipmentController.createRto
);

router.post(
  '/reverse',
  can('shipment.create'),
  shipmentController.createReverse
);

router.get(
  '/thread/:orderId',
  can('shipment.view'),
  shipmentController.getOrderThread
);

router.get(
  '/',
  can('shipment.view'),
  shipmentController.listShipments
);

router.get(
  '/summary',
  can('shipment.view'),
  shipmentController.getShipmentSummary
);

router.get(
  '/:id',
  can('shipment.view'),
  shipmentController.getShipmentDetail
);

router.put(
  '/:id/cancel',
  can('shipment.cancel'),
  shipmentController.cancelShipment
);

router.post(
  '/:id/cancel',
  can('shipment.cancel'),
  shipmentController.cancelShipment
);

router.post(
  '/cancel',
  can('shipment.cancel'),
  shipmentController.cancelShipment
);

router.post(
  '/bulk-label',
  can('shipment.label_generate'),
  shipmentController.generateBulkLabel
);

router.get(
  '/:id/label',
  can('shipment.label_generate'),
  shipmentController.generateLabel
);

router.post(
  '/:id/label',
  can('shipment.label_generate'),
  shipmentController.generateLabel
);

// Tracking endpoints
router.get(
  '/:id/tracking',
  can('shipment.view'),
  trackingController.getShipmentTracking
);

router.post(
  '/:id/tracking/poll',
  can('shipment.view'),
  manualPollLimiter,
  trackingController.triggerManualPoll
);

module.exports = router;
