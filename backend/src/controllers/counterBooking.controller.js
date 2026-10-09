'use strict';

const counterBookingService = require('../services/counterBooking.service');
const { Order, Shipment, PickupAddress } = require('../models');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

class CounterBookingController {
  /**
   * POST /api/v1/counter-booking/calculate-rate
   */
  async calculateRate(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.body.tenant_id || null;
      const { pickupPincode, deliveryPincode, weightKg, consignmentType } = req.body;

      const rateQuote = await counterBookingService.calculateRate({
        pickupPincode,
        deliveryPincode,
        weightKg,
        consignmentType,
        tenantId,
      });

      return res.status(200).json({
        success: true,
        data: rateQuote,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/counter-booking/book
   */
  async bookOrder(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.body.tenant_id;
      if (!tenantId) {
        throw new BadRequestError('Tenant context is required for booking counter orders');
      }

      const result = await counterBookingService.bookCounterOrder(
        tenantId,
        req.body,
        req.user?.id
      );

      return res.status(201).json({
        success: true,
        data: result,
        message: `Order successfully booked with AWB ${result.awb_number || 'Generated'} via ${result.courier_name}`,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/counter-booking/daily-summary
   */
  async getDailySummary(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.query.tenant_id || null;
      const date = req.query.date || null;

      const summary = await counterBookingService.getDailyCounterSummary(tenantId, date);

      return res.status(200).json({
        success: true,
        data: summary,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/counter-booking/receipt/:orderId
   */
  async getReceipt(req, res, next) {
    try {
      const { orderId } = req.params;
      const tenantId = req.tenant?.id || null;

      const orderWhere = { id: orderId };
      if (tenantId) orderWhere.tenant_id = tenantId;

      const order = await Order.findOne({
        where: orderWhere,
        include: ['pickupAddress'],
      });

      if (!order) {
        throw new NotFoundError('Booking order not found');
      }

      const shipment = await Shipment.findOne({
        where: { order_id: order.id },
        include: ['provider'],
      });

      const receipt = counterBookingService.buildReceiptData(order, shipment, order.pickupAddress);

      return res.status(200).json({
        success: true,
        data: receipt,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/counter-booking/offices
   * List all booking offices (pickup addresses) across the platform.
   */
  async getBookingOffices(req, res, next) {
    try {
      const { is_active, tenant_id, search } = req.query;
      const offices = await counterBookingService.getBookingOffices({
        is_active,
        tenant_id,
        search,
      });

      return res.status(200).json({
        success: true,
        data: offices,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/counter-booking/offices/:id/status
   * Toggle booking office activation status (enable / disable).
   */
  async toggleOfficeStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const result = await counterBookingService.toggleOfficeStatus(id, is_active);

      return res.status(200).json({
        success: true,
        data: result,
        message: result.message,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/counter-booking/orders
   * Get orders booked from different booking offices with complete value details.
   */
  async getCounterOrders(req, res, next) {
    try {
      const {
        tenant_id,
        pickup_address_id,
        payment_method,
        status,
        search,
        limit,
        offset,
        sort,
      } = req.query;

      const result = await counterBookingService.getCounterOrders({
        tenant_id,
        pickup_address_id,
        payment_method,
        status,
        search,
        limit,
        offset,
        sort,
      });

      return res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CounterBookingController();
