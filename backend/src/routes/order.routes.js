const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { createOrderSchema, updateOrderSchema, queryOrdersSchema } = require('../validators/order.validator');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const { requireApprovedKyc } = require('../middlewares/requireApprovedKyc.middleware');

router.use(authenticate);

const { error } = require('../utils/apiResponse');

// Guard: Enforce mutual exclusivity between standard orders and walk-in booking office orders
const enforceBookingOfficeRestriction = async (req, res, next) => {
  const isBookingOffice = Boolean(req.tenant?.is_booking_office);
  const isWalkinOrder = Boolean(req.body?.is_walkin) || req.body?.booking_type === 'booking_office';

  if (isBookingOffice && !isWalkinOrder) {
    return error(res, {
      code: 'BOOKING_OFFICE_RESTRICTED',
      message: 'Booking Office accounts are restricted to Walk-in Counter bookings. Normal order creation is disabled.',
    }, 403);
  }

  if (!isBookingOffice && isWalkinOrder) {
    return error(res, {
      code: 'WALKIN_BOOKING_DISABLED',
      message: 'Walk-in booking is only available when Booking Office mode is enabled.',
    }, 403);
  }

  next();
};

// Orders CRUD and Dashboard summary Routes
router.get('/', can('order.view'), validate(queryOrdersSchema, 'query'), (req, res, next) => orderController.getOrders(req, res, next));
router.get('/summary', can('order.view'), (req, res, next) => orderController.getSummary(req, res, next));
router.post('/', can('order.create'), requireApprovedKyc, validate(createOrderSchema, 'body'), enforceBookingOfficeRestriction, (req, res, next) => orderController.createOrder(req, res, next));
router.post('/bulk-pdf', can('order.view'), (req, res, next) => orderController.generateBulkOrderPdf(req, res, next));
router.post('/bulk-allocate-courier', can('order.update'), (req, res, next) => orderController.bulkAllocateCourier(req, res, next));

router.get('/:id', can('order.view'), (req, res, next) => orderController.getOrderById(req, res, next));
router.get('/:id/pdf', can('order.view'), (req, res, next) => orderController.getOrderPdf(req, res, next));
router.get('/:id/receipt', can('order.view'), (req, res, next) => orderController.getWalkinReceipt(req, res, next));
router.put('/:id', can('order.update'), validate(updateOrderSchema, 'body'), (req, res, next) => orderController.updateOrder(req, res, next));
router.put('/:id/status', can('order.update'), (req, res, next) => orderController.changeStatus(req, res, next));
router.delete('/:id', can('order.delete'), (req, res, next) => orderController.cancelOrder(req, res, next));

module.exports = router;
