'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fileUploadService = require('./fileUpload.service');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Renders A4 Invoice PDF and uploads it to storage.
 * @param {object} invoice - Invoice instance including lineItems and Tenant
 */
async function generateInvoicePdf(invoice) {
  try {
    const pdfDoc = await PDFDocument.create();
    
    // A4 dimensions: 595.27 x 841.89 points
    const width = 595.27;
    const height = 841.89;
    const page = pdfDoc.addPage([width, height]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helpers to draw text
    const drawText = (text, x, y, size = 10, isBold = false) => {
      page.drawText(text.toString(), {
        x,
        y: height - y, // Invert coordinates (0 is bottom of page in pdf-lib)
        size,
        font: isBold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const drawLine = (x1, y1, x2, y2) => {
      page.drawLine({
        start: { x: x1, y: height - y1 },
        end: { x: x2, y: height - y2 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    // Header Title
    drawText('TAX INVOICE', 40, 50, 18, true);

    // Platform (Invoicer) Details
    drawText('ISSUED BY:', 40, 90, 8, true);
    drawText(config.billing.entityLegalName, 40, 105, 10, true);
    drawText(config.billing.entityAddress, 40, 120, 9);
    drawText(`GSTIN: ${invoice.billing_entity_gstin}`, 40, 135, 9, true);

    // Invoice Summary Info (Right-aligned)
    drawText(`Invoice No: ${invoice.invoice_number}`, 380, 90, 10, true);
    drawText(`Invoice Date: ${new Date(invoice.created_at || new Date()).toLocaleDateString('en-IN')}`, 380, 105, 9);
    drawText(`Place of Supply: ${invoice.place_of_supply}`, 380, 120, 9);
    drawText(`Type: ${invoice.invoice_type.toUpperCase()}`, 380, 135, 9);

    drawLine(40, 155, 555, 155);

    // Tenant (Billed To) Details
    drawText('BILLED TO:', 40, 175, 8, true);
    const tenantCompanyName = invoice.tenant ? invoice.tenant.company_name : 'Valued Tenant';
    const tenantGstin = invoice.tenant ? invoice.tenant.gstin : 'N/A';
    // Use fallback place of supply details
    const tenantAddress = invoice.tenant ? `${invoice.tenant.company_name}, Billed State: ${invoice.place_of_supply}` : `State: ${invoice.place_of_supply}`;
    
    drawText(tenantCompanyName, 40, 190, 10, true);
    drawText(tenantAddress, 40, 205, 9);
    drawText(`GSTIN: ${tenantGstin || 'N/A'}`, 40, 220, 9, true);

    drawLine(40, 240, 555, 240);

    // Table Headers
    drawText('Description', 40, 260, 9, true);
    drawText('SAC', 250, 260, 9, true);
    drawText('Qty', 320, 260, 9, true);
    drawText('Unit Price (Rs.)', 360, 260, 9, true);
    drawText('Amount (Rs.)', 480, 260, 9, true);

    drawLine(40, 275, 555, 275);

    // Draw Line Items
    let currentY = 295;
    const items = invoice.lineItems || [];
    
    items.forEach((item) => {
      drawText(item.description, 40, currentY, 9);
      drawText(item.hsn_sac_code || '996812', 250, currentY, 9);
      drawText(item.quantity, 325, currentY, 9);
      drawText(parseFloat(item.unit_price).toFixed(2), 365, currentY, 9);
      drawText(parseFloat(item.amount).toFixed(2), 485, currentY, 9);
      currentY += 20;
    });

    drawLine(40, currentY, 555, currentY);
    currentY += 25;

    // Financial calculations summary (CGST/SGST/IGST splits)
    drawText('Subtotal:', 380, currentY, 9);
    drawText(`Rs. ${parseFloat(invoice.subtotal).toFixed(2)}`, 480, currentY, 9);
    currentY += 15;

    if (parseFloat(invoice.cgst_amount) > 0) {
      drawText('CGST (9%):', 380, currentY, 9);
      drawText(`Rs. ${parseFloat(invoice.cgst_amount).toFixed(2)}`, 480, currentY, 9);
      currentY += 15;
      drawText('SGST (9%):', 380, currentY, 9);
      drawText(`Rs. ${parseFloat(invoice.sgst_amount).toFixed(2)}`, 480, currentY, 9);
      currentY += 15;
    }

    if (parseFloat(invoice.igst_amount) > 0) {
      drawText('IGST (18%):', 380, currentY, 9);
      drawText(`Rs. ${parseFloat(invoice.igst_amount).toFixed(2)}`, 480, currentY, 9);
      currentY += 15;
    }

    drawLine(380, currentY, 555, currentY);
    currentY += 15;

    drawText('Total Value:', 380, currentY, 11, true);
    drawText(`Rs. ${parseFloat(invoice.total_amount).toFixed(2)}`, 480, currentY, 11, true);

    // Save and upload PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const safeNum = invoice.invoice_number.replace(/\//g, '-');
    const pdfUrl = await fileUploadService.uploadFile(
      pdfBuffer,
      'billing/invoices',
      `invoice-${safeNum}.pdf`,
      'application/pdf'
    );

    return pdfUrl;
  } catch (err) {
    logger.error(`[InvoicePdfService] Error generating PDF for invoice: ${err.message}`);
    throw err;
  }
}

/**
 * Renders A4 Customer Order Invoice PDF.
 * @param {object} order - Order instance including items, tenant, pickupAddress
 */
async function generateOrderPdf(order) {
  try {
    const pdfDoc = await PDFDocument.create();
    const width = 595.27;
    const height = 841.89;
    const page = pdfDoc.addPage([width, height]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text, x, y, size = 10, isBold = false) => {
      page.drawText(text ? text.toString() : '', {
        x,
        y: height - y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const drawLine = (x1, y1, x2, y2) => {
      page.drawLine({
        start: { x: x1, y: height - y1 },
        end: { x: x2, y: height - y2 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    // Header Title
    drawText('CUSTOMER ORDER INVOICE', 40, 50, 18, true);

    // Merchant Info
    drawText('STORE / MERCHANT:', 40, 90, 8, true);
    drawText(order.tenant ? order.tenant.company_name : 'Nanoshipy Store', 40, 105, 10, true);
    drawText(`Email: ${order.tenant ? order.tenant.support_email || 'care@nanoshipy.com' : 'care@nanoshipy.com'}`, 40, 120, 9);
    drawText(`Phone: ${order.tenant ? order.tenant.support_phone || 'N/A' : 'N/A'}`, 40, 135, 9);

    // Order Info Right
    drawText(`Order Ref: ${order.order_reference}`, 360, 90, 10, true);
    drawText(`Order Date: ${new Date(order.created_at || new Date()).toLocaleDateString('en-IN')}`, 360, 105, 9);
    drawText(`Payment Mode: ${order.payment_mode.toUpperCase()}`, 360, 120, 9, true);
    drawText(`COD Amount: Rs. ${order.cod_amount ? parseFloat(order.cod_amount).toFixed(2) : '0.00'}`, 360, 135, 9);

    drawLine(40, 155, 555, 155);

    // Customer Delivery Details
    drawText('DELIVER TO:', 40, 175, 8, true);
    drawText(order.customer_name, 40, 190, 10, true);
    drawText(`${order.shipping_address_line1}, ${order.shipping_city}, ${order.shipping_state} - ${order.shipping_pincode}`, 40, 205, 9);
    drawText(`Phone: ${order.customer_phone} | Email: ${order.customer_email || 'N/A'}`, 40, 220, 9);

    drawLine(40, 240, 555, 240);

    // Items Header
    drawText('Product Item', 40, 260, 9, true);
    drawText('Qty', 320, 260, 9, true);
    drawText('Unit Price (Rs.)', 370, 260, 9, true);
    drawText('Total (Rs.)', 480, 260, 9, true);

    drawLine(40, 275, 555, 275);

    let currentY = 295;
    const items = order.items || [
      { product_name: 'Consignment Package Item', quantity: 1, unit_price: order.order_value }
    ];

    items.forEach((item) => {
      const name = item.product_name || item.name || 'Product Package';
      const qty = item.quantity || 1;
      const price = parseFloat(item.unit_price || order.order_value);
      const total = qty * price;

      drawText(name, 40, currentY, 9);
      drawText(qty, 325, currentY, 9);
      drawText(price.toFixed(2), 375, currentY, 9);
      drawText(total.toFixed(2), 485, currentY, 9);
      currentY += 20;
    });

    drawLine(40, currentY, 555, currentY);
    currentY += 25;

    drawText('Grand Total:', 380, currentY, 11, true);
    drawText(`Rs. ${parseFloat(order.order_value).toFixed(2)}`, 480, currentY, 11, true);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    logger.error(`[InvoicePdfService] Error generating order PDF: ${err.message}`);
    throw err;
  }
}

module.exports = {
  generateInvoicePdf,
  generateOrderPdf,
};
