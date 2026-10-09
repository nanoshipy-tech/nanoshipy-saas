'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const bwipjs = require('bwip-js');
const { Order, Shipment, CourierProvider, PickupAddress, Tenant } = require('../models');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Generate a Barcode Buffer (Code128) using bwip-js
 */
function generateBarcodeBuffer(text) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'code128',
        text: String(text || 'AWB-PENDING').trim(),
        scale: 3,
        height: 12,
        includetext: false,
      },
      (err, png) => {
        if (err) {
          logger.error(`Failed to generate barcode for receipt: ${err.message}`);
          reject(err);
        } else {
          resolve(png);
        }
      }
    );
  });
}

/**
 * Synchronously resolves clean carrier name from shipment attributes, raw provider response, or carrier ID map.
 */
function getCleanCarrierName(shipment, order = null) {
  if (!shipment) return 'Standard Courier Partner';

  const awb = shipment.awb_number || '';
  const provKey = String(shipment.provider?.provider_key || '').toLowerCase();
  const rawResp = shipment.provider_raw_response || {};
  const awbResp = rawResp.awb_response || {};

  // 1. Check numeric carrier ID from awb_response, root raw, or shipment service_type
  const rawCarrierId = String(
    awbResp.carrier_id ||
    rawResp.carrier_id ||
    shipment.service_type ||
    ''
  ).trim();

  const shipwayCarrierIdMap = {
    '7377': 'Blue Dart • Express',
    '81769': 'Blue Dart • Surface',
    '7442': 'Delhivery • Express',
    '80622': 'Delhivery • Surface',
    '80652': 'Xpressbees • Express',
    '80593': 'Xpressbees • Surface',
    '80800': 'DTDC • Express',
    '79681': 'Shadowfax • Surface',
    '82861': 'Ekart • Surface',
    '19339': 'Amazon • Surface',
  };

  if (shipwayCarrierIdMap[rawCarrierId]) {
    return shipwayCarrierIdMap[rawCarrierId];
  }

  // 2. Direct carrier title/name from Shipway raw response
  const rawCarrierName = (
    awbResp.carrier_title ||
    awbResp.carrier_name ||
    rawResp.carrier_title ||
    rawResp.carrier_name ||
    rawResp.carrier ||
    ''
  ).trim();

  if (rawCarrierName) {
    const lower = rawCarrierName.toLowerCase();
    if (lower.includes('blue') || lower.includes('dart')) {
      return (lower.includes('air') || lower.includes('exp')) ? 'Blue Dart • Express' : 'Blue Dart • Surface';
    }
    if (lower.includes('delhivery')) {
      return (lower.includes('air') || lower.includes('exp')) ? 'Delhivery • Express' : 'Delhivery • Surface';
    }
    if (lower.includes('xpress') || lower.includes('bees')) {
      return (lower.includes('air') || lower.includes('exp')) ? 'Xpressbees • Express' : 'Xpressbees • Surface';
    }
    if (lower.includes('dtdc')) {
      return 'DTDC • Express';
    }
    if (lower.includes('shadowfax')) {
      return 'Shadowfax • Surface';
    }
    if (lower.includes('ekart')) {
      return 'Ekart • Surface';
    }
    if (lower.includes('amazon')) {
      return 'Amazon • Surface';
    }
    if (lower.includes('st') || lower.includes('tamil')) {
      return 'ST Courier';
    }
    if (!lower.includes('shipway')) {
      return rawCarrierName;
    }
  }

  // 3. ST Courier detection
  if (provKey === 'stcourier' || awb.startsWith('ST') || String(shipment.service_type || '').includes('st_courier')) {
    return 'ST Courier';
  }

  // 4. Fallback via labelGenerationService
  try {
    const labelGenerationService = require('./labelGeneration.service');
    const badge = labelGenerationService.getCleanCarrierBadge(shipment.provider, shipment);
    if (badge && !badge.toLowerCase().includes('shipway') && badge !== 'COURIER • SURFACE') {
      return badge.split(' • ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' • ');
    }
  } catch (_) {}

  return null;
}

/**
 * Resolves the concerned courier name for retail customer receipts.
 * Fetches the actual courier name from Shipway response or carrier mappings,
 * ensuring generic aggregator names like "Shipway Multi-Carrier" are never displayed.
 */
async function resolveConcernedCourierName(shipment, order = null) {
  const syncName = getCleanCarrierName(shipment, order);
  if (syncName) return syncName;

  const awb = shipment?.awb_number || '';
  const provKey = String(shipment?.provider?.provider_key || '').toLowerCase();

  // Dynamic fetch from Shipway tracking API if provider is shipway
  if (provKey === 'shipway' && awb && awb !== 'PENDING') {
    try {
      const { CourierProvider } = require('../models');
      const { ProviderFactory } = require('../providers');
      const providerCredentialService = require('./providerCredential.service');
      const prov = await CourierProvider.findOne({ where: { provider_key: 'shipway', is_active: true } });
      if (prov && prov.credentials_encrypted) {
        const credentials = providerCredentialService.decrypt(prov.credentials_encrypted);
        const adapter = await ProviderFactory.getAdapter('shipway', credentials, prov.config || {}, prov.id);
        const trackRes = await adapter.trackShipment({ awbNumber: awb });
        const details = trackRes?.data || trackRes?.providerRawResponse?.[0]?.tracking_details;
        const fetchedCarrier = details?.carrier_name || details?.carrier || details?.carrier_title;
        if (fetchedCarrier && !String(fetchedCarrier).toLowerCase().includes('shipway')) {
          const lower = String(fetchedCarrier).toLowerCase();
          let resolved = String(fetchedCarrier);
          if (lower.includes('blue') || lower.includes('dart')) resolved = 'Blue Dart • Express';
          else if (lower.includes('delhivery')) resolved = 'Delhivery • Express';
          else if (lower.includes('xpress') || lower.includes('bees')) resolved = 'Xpressbees • Express';
          else if (lower.includes('dtdc')) resolved = 'DTDC • Express';

          // Asynchronously cache into shipment raw response
          shipment.update({
            provider_raw_response: {
              ...(shipment.provider_raw_response || {}),
              carrier_name: fetchedCarrier,
              awb_response: {
                ...(shipment.provider_raw_response?.awb_response || {}),
                carrier_name: fetchedCarrier,
              },
            },
          }).catch(() => {});

          return resolved;
        }
      }
    } catch (fetchErr) {
      logger.warn(`[Receipt] Dynamic Shipway carrier lookup note: ${fetchErr.message}`);
    }
  }

  // Safe default (Never show "Shipway Multi-Carrier" to retail counter customers)
  return 'Express Courier Partner';
}

/**
 * Generates a standard Retail Courier Booking Receipt PDF
 * @param {string} orderId
 * @param {string} [tenantId]
 * @returns {Promise<Uint8Array>} PDF byte buffer
 */
async function generateWalkinReceipt(orderId, tenantId = null) {
  const whereClause = { id: orderId };
  if (tenantId) whereClause.tenant_id = tenantId;

  const order = await Order.findOne({
    where: whereClause,
    include: [
      {
        model: PickupAddress,
        as: 'pickupAddress',
      },
      {
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'company_name', 'support_email', 'support_phone', 'subdomain'],
      },
      {
        model: Shipment.unscoped(),
        as: 'shipments',
        attributes: [
          'id', 'awb_number', 'courier_shipment_id', 'service_type', 'status', 'label_url', 'provider_raw_response'
        ],
        include: [{ model: CourierProvider, as: 'provider', attributes: ['id', 'display_name', 'provider_key'] }],
      },
    ],
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const shipment = order.shipments && order.shipments.length > 0 ? order.shipments[0] : null;
  const awbNumber = shipment?.awb_number || 'PENDING';
  const carrierName = await resolveConcernedCourierName(shipment, order);

  const pdfDoc = await PDFDocument.create();

  // Receipt format: 400 pt width x 600 pt height (Compact POS / Courier Counter Receipt)
  const width = 420;
  const height = 650;
  const page = pdfDoc.addPage([width, height]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const colorPrimary = rgb(0.35, 0.05, 0.60); // #5B069A Purple
  const colorDark = rgb(0.1, 0.1, 0.1);
  const colorGray = rgb(0.4, 0.4, 0.4);
  const colorLightGray = rgb(0.85, 0.85, 0.88);
  const colorAccentBg = rgb(0.96, 0.94, 0.99);

  let currentY = height - 28;

  const drawText = (text, x, y, size = 9, isBold = false, color = colorDark) => {
    page.drawText(String(text || ''), {
      x,
      y,
      size,
      font: isBold ? fontBold : fontRegular,
      color,
    });
  };

  const drawCenteredText = (text, y, size = 10, isBold = false, color = colorDark) => {
    const font = isBold ? fontBold : fontRegular;
    const textWidth = font.widthOfTextAtSize(String(text || ''), size);
    const x = (width - textWidth) / 2;
    page.drawText(String(text || ''), { x, y, size, font, color });
  };

  const drawLine = (y, thickness = 0.75, color = colorLightGray) => {
    page.drawLine({
      start: { x: 20, y },
      end: { x: width - 20, y },
      thickness,
      color,
    });
  };

  // --- HEADER: LOGO & BRANDING ---
  drawCenteredText('NANOSHIPY LOGISTICS', currentY, 15, true, colorPrimary);
  currentY -= 14;
  drawCenteredText('RETAIL COURIER BOOKING COUNTER RECEIPT', currentY, 8.5, true, colorGray);
  currentY -= 16;

  // Booking Office Info
  const officeName = order.tenant?.company_name || 'Nanoshipy Booking Office';
  const officePhone = order.tenant?.support_phone || order.pickupAddress?.contact_phone || '+91 80 6534 0848';
  const officeEmail = order.tenant?.support_email || 'care@nanoshipy.com';
  const officeAddr = order.pickupAddress?.address_line1 
    ? `${order.pickupAddress.address_line1}, ${order.pickupAddress.city} - ${order.pickupAddress.pincode}`
    : 'Authorized Booking Branch Counter';

  drawCenteredText(`Branch / Counter: ${officeName}`, currentY, 9, true, colorDark);
  currentY -= 12;
  drawCenteredText(officeAddr, currentY, 7.5, false, colorGray);
  currentY -= 11;
  drawCenteredText(`Helpline: ${officePhone}  |  Email: ${officeEmail}`, currentY, 7.5, false, colorGray);
  currentY -= 14;

  drawLine(currentY);
  currentY -= 14;

  // --- BOOKING DETAILS & DATE ---
  const bookingTimeStr = new Date(order.created_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  drawText('Booking Ref #:', 24, currentY, 9, false, colorGray);
  drawText(order.order_reference, 100, currentY, 9.5, true, colorDark);

  drawText('Date & Time:', 240, currentY, 8.5, false, colorGray);
  drawText(bookingTimeStr, 300, currentY, 8.5, true, colorDark);
  currentY -= 18;

  // --- ASSIGNED CARRIER & AWB BARCODE BOX ---
  page.drawRectangle({
    x: 20,
    y: currentY - 72,
    width: width - 40,
    height: 72,
    color: colorAccentBg,
    borderColor: rgb(0.8, 0.7, 0.9),
    borderWidth: 1,
  });

  drawText('Assigned Carrier:', 32, currentY - 14, 8.5, false, colorGray);
  drawText(carrierName.toUpperCase(), 110, currentY - 14, 10, true, colorPrimary);

  drawText('AWB / Waybill #:', 32, currentY - 28, 8.5, false, colorGray);
  drawText(awbNumber, 110, currentY - 28, 10, true, colorDark);

  // Barcode Image
  try {
    const barcodePng = await generateBarcodeBuffer(awbNumber);
    const barcodeImage = await pdfDoc.embedPng(barcodePng);
    page.drawImage(barcodeImage, {
      x: 230,
      y: currentY - 64,
      width: 155,
      height: 48,
    });
  } catch (err) {
    logger.warn(`Could not render barcode on receipt: ${err.message}`);
    drawText(`[ ${awbNumber} ]`, 260, currentY - 45, 10, true, colorDark);
  }

  currentY -= 84;

  // --- SENDER & RECEIVER DUAL CARDS ---
  const colWidth = (width - 50) / 2;

  // Sender Box (Left)
  page.drawRectangle({
    x: 20,
    y: currentY - 120,
    width: colWidth,
    height: 120,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: colorLightGray,
    borderWidth: 0.75,
  });

  page.drawRectangle({
    x: 20,
    y: currentY - 20,
    width: colWidth,
    height: 20,
    color: rgb(0.92, 0.92, 0.96),
  });
  drawText('SENDER (WALK-IN CUSTOMER)', 28, currentY - 14, 8, true, colorPrimary);

  const senderName = order.sender_name || order.pickupAddress?.contact_name || 'Walk-in Retail Customer';
  const senderPhone = order.sender_phone || order.pickupAddress?.contact_phone || '-';
  const senderAddr = [order.sender_address_line1, order.sender_address_line2].filter(Boolean).join(', ') || order.pickupAddress?.address_line1 || 'Origin Counter';
  const senderCity = `${order.sender_city || order.pickupAddress?.city || ''} ${order.sender_pincode || order.pickupAddress?.pincode ? `(${order.sender_pincode || order.pickupAddress?.pincode})` : ''}`.trim();

  let senderY = currentY - 34;
  drawText(senderName, 28, senderY, 8.5, true, colorDark);
  senderY -= 13;
  drawText(`Ph: ${senderPhone}`, 28, senderY, 8, false, colorDark);
  senderY -= 13;
  drawText(senderAddr.slice(0, 32), 28, senderY, 7.5, false, colorGray);
  senderY -= 12;
  if (senderAddr.length > 32) {
    drawText(senderAddr.slice(32, 64), 28, senderY, 7.5, false, colorGray);
    senderY -= 12;
  }
  drawText(senderCity, 28, senderY, 8, true, colorDark);

  // Receiver Box (Right)
  page.drawRectangle({
    x: 30 + colWidth,
    y: currentY - 120,
    width: colWidth,
    height: 120,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: colorLightGray,
    borderWidth: 0.75,
  });

  page.drawRectangle({
    x: 30 + colWidth,
    y: currentY - 20,
    width: colWidth,
    height: 20,
    color: rgb(0.92, 0.92, 0.96),
  });
  drawText('CONSIGNEE (RECEIVER)', 38 + colWidth, currentY - 14, 8, true, colorPrimary);

  const receiverName = order.customer_name || 'Valued Consignee';
  const receiverPhone = order.customer_phone || '-';
  const receiverAddr = `${order.shipping_address_line1 || ''}${order.shipping_address_line2 ? ', ' + order.shipping_address_line2 : ''}`;
  const receiverCityStatePin = `${order.shipping_city || ''}, ${order.shipping_state || ''} - ${order.shipping_pincode || ''}`;

  let receiverY = currentY - 34;
  drawText(receiverName, 38 + colWidth, receiverY, 8.5, true, colorDark);
  receiverY -= 13;
  drawText(`Ph: ${receiverPhone}`, 38 + colWidth, receiverY, 8, false, colorDark);
  receiverY -= 13;
  drawText(receiverAddr.slice(0, 32), 38 + colWidth, receiverY, 7.5, false, colorGray);
  receiverY -= 12;
  if (receiverAddr.length > 32) {
    drawText(receiverAddr.slice(32, 64), 38 + colWidth, receiverY, 7.5, false, colorGray);
    receiverY -= 12;
  }
  drawText(receiverCityStatePin.slice(0, 32), 38 + colWidth, receiverY, 8, true, colorDark);

  currentY -= 132;

  // --- SHIPMENT SPECIFICATIONS TABLE ---
  drawLine(currentY);
  currentY -= 14;

  const consignmentTypeStr = order.consignment_type === 'document' ? 'Document / Letter' : 'Parcel / Non-Document';
  const weightStr = `${parseFloat(order.weight_kg || 0.5).toFixed(2)} KG`;
  const dimensionsStr = `${order.length_cm || 10} x ${order.width_cm || 10} x ${order.height_cm || 10} cm`;
  const declaredValStr = `INR ${parseFloat(order.order_value || 0).toFixed(2)}`;

  drawText('Consignment Type:', 24, currentY, 8.5, false, colorGray);
  drawText(consignmentTypeStr, 120, currentY, 8.5, true, colorDark);

  drawText('Package Weight:', 230, currentY, 8.5, false, colorGray);
  drawText(weightStr, 320, currentY, 9, true, colorDark);
  currentY -= 16;

  drawText('Dimensions (LWH):', 24, currentY, 8.5, false, colorGray);
  drawText(dimensionsStr, 120, currentY, 8.5, false, colorDark);

  drawText('Declared Value:', 230, currentY, 8.5, false, colorGray);
  drawText(declaredValStr, 320, currentY, 8.5, false, colorDark);
  currentY -= 20;

  // --- TOTAL AMOUNT PAID & PAYMENT HIGHLIGHT BOX ---
  page.drawRectangle({
    x: 20,
    y: currentY - 50,
    width: width - 40,
    height: 50,
    color: rgb(0.12, 0.45, 0.25), // Forest Emerald Green
  });

  const amountPaid = parseFloat(order.amount_collected || order.counter_amount_collected || order.order_value || 0).toFixed(2);
  const paymentModeStr = (order.counter_payment_method || order.payment_mode || 'PAID (RETAIL COUNTER)').toUpperCase();

  drawText('TOTAL AMOUNT PAID:', 32, currentY - 24, 10, true, rgb(1, 1, 1));
  drawText(`INR ${amountPaid}`, 32, currentY - 42, 14, true, rgb(1, 1, 1));

  drawText('PAYMENT STATUS:', 240, currentY - 22, 8.5, false, rgb(0.85, 0.95, 0.88));
  drawText(`${paymentModeStr} - SUCCESS`, 240, currentY - 38, 9.5, true, rgb(1, 1, 1));

  currentY -= 64;

  // --- TRACKING & FOOTER TERMS ---
  drawCenteredText('Track your shipment online anytime at:', currentY, 8, false, colorGray);
  currentY -= 12;
  drawCenteredText(`https://app.nanoshipy.com/track/${awbNumber}`, currentY, 8.5, true, colorPrimary);
  currentY -= 16;

  drawLine(currentY, 0.5);
  currentY -= 12;

  drawCenteredText('Thank you for shipping with Nanoshipy!', currentY, 8, true, colorDark);
  currentY -= 10;
  drawCenteredText('Goods booked are subject to carrier terms & conditions. Keep this receipt safe for claims.', currentY, 6.5, false, colorGray);
  currentY -= 14;

  // Dual Signatures
  drawText('Customer Signature', 36, currentY, 7.5, false, colorGray);
  drawText('Booking Clerk Signature & Stamp', 240, currentY, 7.5, false, colorGray);

  return pdfDoc.save();
}

module.exports = {
  generateWalkinReceipt,
  resolveConcernedCourierName,
  getCleanCarrierName,
};
