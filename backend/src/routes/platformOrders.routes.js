'use strict';

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { getSellerSummary } = require('../controllers/sellerWiseReport.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const validate = require('../middlewares/validate.middleware');
const { queryOrdersSchema } = require('../validators/order.validator');

router.use(isPlatformAdmin);

router.get('/seller-summary', (req, res, next) => getSellerSummary(req, res, next));
router.get('/summary', (req, res, next) => orderController.getSummary(req, res, next));
router.get('/', validate(queryOrdersSchema, 'query'), (req, res, next) => orderController.getOrders(req, res, next));
router.get('/:id', (req, res, next) => orderController.getOrderById(req, res, next));

module.exports = router;
