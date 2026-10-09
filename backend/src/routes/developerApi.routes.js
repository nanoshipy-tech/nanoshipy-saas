'use strict';

const express = require('express');
const router = express.Router();
const { publicApiAuth } = require('../middlewares/publicApiAuth.middleware');
const publicApiController = require('../controllers/publicApi.controller');

// Apply Bearer-Token Guard to all public API endpoints
router.use(publicApiAuth);

// G2 Developer API routes (/v1/*)
router.post('/orders', publicApiController.createOrder);
router.get('/orders', publicApiController.listOrders);
router.get('/orders/:orderId', publicApiController.getOrder);
router.post('/orders/:orderId/cancel', publicApiController.cancelOrder);

router.post('/shipments/:orderId/book', publicApiController.bookShipment);

router.get('/rates', publicApiController.getRates);
router.get('/serviceability', publicApiController.getServiceability);
router.get('/tracking/:awb', publicApiController.getTracking);

router.get('/ndr', publicApiController.getNdrQueue);
router.post('/ndr/:awb/reattempt', publicApiController.ndrReattempt);
router.post('/ndr/:awb/rto', publicApiController.ndrRto);

router.post('/returns', publicApiController.createReturn);

router.get('/wallet/balance', publicApiController.getWalletBalance);
router.get('/wallet/ledger', publicApiController.getWalletLedger);

router.post('/webhooks', publicApiController.createWebhookSubscription);
router.get('/webhooks', publicApiController.listWebhookSubscriptions);
router.delete('/webhooks/:id', publicApiController.deleteWebhookSubscription);

module.exports = router;
