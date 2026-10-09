'use strict';

const { PDFDocument } = require('pdf-lib');
const { Order, OrderItem, PickupAddress, Tenant } = require('../models');
const invoicePdfService = require('./invoicePdf.service');
const fileUploadService = require('./fileUpload.service');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class BulkOrderService {
  /**
   * Merges multiple PDF buffers into a single PDF document.
   *
   * @param {Array<Buffer>} pdfBuffers
   * @returns {Promise<Buffer>} Merged PDF document buffer
   */
  async mergePDFs(pdfBuffers) {
    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      try {
        const doc = await PDFDocument.load(buffer);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        logger.error(`Error copying pages from Order PDF buffer: ${err.message}`);
      }
    }

    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  }

  /**
   * Generates and merges order invoices/packing slips for multiple orders.
   *
   * @param {Array<string>} orderIds - Array of Order UUIDs
   * @param {string} tenantId - Current tenant ID
   * @param {object} [tenantObj=null] - Optional current tenant model instance
   * @returns {Promise<{ pdf_url: string, count: number }>} URL of the merged PDF file and order count
   */
  async generateBulkOrderPDF(orderIds, tenantId, tenantObj = null) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestError('Order IDs must be a non-empty array.');
    }

    if (orderIds.length > 100) {
      throw new BadRequestError('Cannot merge more than 100 order invoices in a single batch to protect system memory limits.');
    }

    let tenant = tenantObj;
    if (!tenant && tenantId) {
      tenant = await Tenant.findByPk(tenantId);
    }

    const orders = await Order.findAll({
      where: {
        id: orderIds,
        tenant_id: tenantId,
      },
      include: [
        { model: OrderItem, as: 'items' },
        { model: PickupAddress, as: 'pickupAddress' },
      ],
    });

    if (orders.length === 0) {
      throw new NotFoundError('No matching orders found for the given IDs.');
    }

    // Preserve the order of orderIds passed by the user
    const orderMap = {};
    orders.forEach((o) => {
      orderMap[o.id] = o;
    });

    const pdfBuffers = [];

    for (const id of orderIds) {
      const order = orderMap[id];
      if (!order) continue;

      try {
        order.tenant = tenant;
        const pdfBuffer = await invoicePdfService.generateOrderPdf(order);
        if (pdfBuffer) {
          pdfBuffers.push(pdfBuffer);
        }
      } catch (err) {
        logger.error(`Failed to render invoice PDF for order ${id}: ${err.message}`);
      }
    }

    if (pdfBuffers.length === 0) {
      throw new BadRequestError('Failed to generate PDF invoices for any of the selected orders.');
    }

    logger.info(`Merging ${pdfBuffers.length} order invoice PDFs into a single file.`);
    const mergedBuffer = await this.mergePDFs(pdfBuffers);

    // Save the merged PDF to file storage
    const destinationPath = 'orders/bulk_invoices';
    const batchId = require('crypto').randomBytes(8).toString('hex');
    const originalName = `merged_orders_${batchId}.pdf`;
    const mimeType = 'application/pdf';

    const mergedUrl = await fileUploadService.uploadFile(mergedBuffer, destinationPath, originalName, mimeType);
    logger.info(`Bulk order PDF generated successfully. Uploaded location: ${mergedUrl}`);

    return {
      pdf_url: mergedUrl,
      count: pdfBuffers.length,
    };
  }
}

module.exports = new BulkOrderService();
