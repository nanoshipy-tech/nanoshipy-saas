const orderService = require('../services/order.service');

class OrderController {
  async getOrders(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.query.tenant_id || null;
      const result = await orderService.listOrders(tenantId, req.query);
      res.status(200).json({ success: true, data: result, error: null });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.query.tenant_id || null;
      const summary = await orderService.getOrderSummary(tenantId);
      res.status(200).json({ success: true, data: summary, error: null });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.query.tenant_id || null;
      const { id } = req.params;
      const order = await orderService.getOrderById(tenantId, id);
      res.status(200).json({ success: true, data: order, error: null });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const order = await orderService.createOrder(tenantId, req.body, req.user.id);
      res.status(201).json({ success: true, data: order, error: null });
    } catch (error) {
      if (error.code === 'DUPLICATE_ORDER_REFERENCE') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async updateOrder(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const order = await orderService.updateOrder(tenantId, id, req.body, req.user.id);
      res.status(200).json({ success: true, data: order, error: null });
    } catch (error) {
      if (error.code === 'DUPLICATE_ORDER_REFERENCE' || error.code === 'ORDER_NOT_EDITABLE') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async changeStatus(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const { status, note } = req.body;
      const order = await orderService.changeStatus(tenantId, id, status, req.user.id, note);
      res.status(200).json({ success: true, data: order, error: null });
    } catch (error) {
      if (error.code === 'INVALID_STATUS_TRANSITION') {
        return res.status(422).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const { note } = req.body;
      const order = await orderService.cancelOrder(tenantId, id, req.user.id, note);
      res.status(200).json({ success: true, data: order, error: null });
    } catch (error) {
      if (error.code === 'ORDER_NOT_EDITABLE') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async getOrderPdf(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.user?.tenant_id;
      const { id } = req.params;
      const order = await orderService.getOrderById(tenantId, id);
      if (!order) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      }
      if (req.tenant) {
        order.tenant = req.tenant;
      }
      const invoicePdfService = require('../services/invoicePdf.service');
      const pdfBuffer = await invoicePdfService.generateOrderPdf(order);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="order-${order.order_reference || id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  async generateBulkOrderPdf(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.user?.tenant_id || req.headers?.['x-tenant-id'] || null;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'Tenant ID is required for bulk order printing' },
        });
      }

      const { order_ids } = req.body;

      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'order_ids must be a non-empty array' },
        });
      }

      const bulkOrderService = require('../services/bulkOrder.service');
      const result = await bulkOrderService.generateBulkOrderPDF(order_ids, tenantId, req.tenant);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getWalkinReceipt(req, res, next) {
    try {
      const tenantId = req.tenant?.id || null;
      const { id } = req.params;
      const receiptPdfService = require('../services/receiptPdf.service');
      const pdfBuffer = await receiptPdfService.generateWalkinReceipt(id, tenantId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="walkin-receipt-${id}.pdf"`);
      return res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      next(error);
    }
  }

  async bulkAllocateCourier(req, res, next) {
    try {
      const tenantId = req.tenant?.id || req.user?.tenant_id || req.headers?.['x-tenant-id'] || null;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'Tenant ID is required for bulk courier allocation' },
        });
      }

      const userId = req.user ? req.user.id : null;
      const { order_ids } = req.body;

      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'order_ids must be a non-empty array' },
        });
      }

      const bulkCourierAllocationService = require('../services/bulkCourierAllocation.service');
      const result = await bulkCourierAllocationService.bulkAllocateCouriers(order_ids, tenantId, userId, req);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
