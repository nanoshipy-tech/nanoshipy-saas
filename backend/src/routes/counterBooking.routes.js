'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const controller = require('../controllers/counterBooking.controller');

const router = express.Router();

router.use(authenticate);

const { error } = require('../utils/apiResponse');

// Guard: Require booking office mode enabled
const requireBookingOffice = (req, res, next) => {
  if (!req.tenant?.is_booking_office) {
    return error(res, {
      code: 'BOOKING_OFFICE_DISABLED',
      message: 'Walk-in counter booking is disabled. This feature is only available for accounts enabled as a Booking Office.',
    }, 403);
  }
  next();
};

// Quick Counter Rate Quote
router.post('/calculate-rate', requireBookingOffice, (req, res, next) => controller.calculateRate(req, res, next));

// 1-Click Counter Order & Shipment Booking
router.post('/book', requireBookingOffice, (req, res, next) => controller.bookOrder(req, res, next));

// Daily Counter Cash Collection & Stats Summary
router.get('/daily-summary', requireBookingOffice, (req, res, next) => controller.getDailySummary(req, res, next));

// Printable Receipt Data
router.get('/receipt/:orderId', (req, res, next) => controller.getReceipt(req, res, next));

// Admin Hub: All booking offices with toggle
router.get('/offices', (req, res, next) => controller.getBookingOffices(req, res, next));
router.patch('/offices/:id/status', (req, res, next) => controller.toggleOfficeStatus(req, res, next));

// Admin Hub: Orders from different booking offices with complete value details
router.get('/orders', (req, res, next) => controller.getCounterOrders(req, res, next));

module.exports = router;
