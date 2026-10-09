'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const bwipjs = require('bwip-js');
const axios = require('axios');
const { Shipment, Order, CourierProvider, PickupAddress, Tenant, TenantSetting } = require('../models');
const ProviderFactory = require('../providers/ProviderFactory');
const providerCredentialService = require('./providerCredential.service');
const fileUploadService = require('./fileUpload.service');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class LabelGenerationService {
  /**
   * Generates a barcode PNG buffer for a given text (Code128).
   */
  async generateBarcode(text, height = 14) {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'code128',
        text: String(text || '').trim(),
        scale: 3,
        height: height,
        includetext: false,
        textalign: 'center',
      }, (err, png) => {
        if (err) {
          logger.error(`Failed to generate barcode for text ${text}: ${err.message}`);
          reject(err);
        } else {
          resolve(png);
        }
      });
    });
  }

  /**
   * Generates a QR Code PNG buffer for tracking URL.
   */
  async generateQRCode(text) {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'qrcode',
        text: String(text || '').trim(),
        scale: 3,
      }, (err, png) => {
        if (err) {
          logger.error(`Failed to generate QR code for text ${text}: ${err.message}`);
          reject(err);
        } else {
          resolve(png);
        }
      });
    });
  }

  numberToIndianWords(num) {
    const n = Math.round(Number(num) || 0);
    if (n <= 0) return '(Zero Rupees Only)';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(num) {
      let s = ('000000000' + num).slice(-9);
      let n = s.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return '';
      let str = '';
      const crore = Number(n[1]);
      const lakh = Number(n[2]);
      const thousand = Number(n[3]);
      const hundred = Number(n[4]);
      const tens = Number(n[5]);

      if (crore > 0) str += (crore < 20 ? a[crore] : b[Math.floor(crore / 10)] + ' ' + a[crore % 10]) + ' Crore ';
      if (lakh > 0) str += (lakh < 20 ? a[lakh] : b[Math.floor(lakh / 10)] + ' ' + a[lakh % 10]) + ' Lakh ';
      if (thousand > 0) str += (thousand < 20 ? a[thousand] : b[Math.floor(thousand / 10)] + ' ' + a[thousand % 10]) + ' Thousand ';
      if (hundred > 0) str += a[hundred] + ' Hundred ';
      if (tens > 0) {
        if (str !== '') str += 'And ';
        str += tens < 20 ? a[tens] : b[Math.floor(tens / 10)] + ' ' + a[tens % 10];
      }
      return str.trim();
    }
    return `(${inWords(n)} Rupees Only)`;
  }

  formatLabelDate(dateVal, compact = false) {
    const d = dateVal ? new Date(dateVal) : new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()] || 'Jan';
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (compact) {
      return `${day} ${month} ${year}`;
    }
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  }

  wrapText(text, maxChars = 32) {
    if (!text) return [];
    const words = String(text).trim().split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if ((currentLine + ' ' + word).length <= maxChars) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  getCleanCarrierBadge(providerOrShipment, maybeShipment) {
    const shipment = maybeShipment || (providerOrShipment?.provider_raw_response ? providerOrShipment : null);
    const provider = maybeShipment ? providerOrShipment : (!providerOrShipment?.provider_raw_response ? providerOrShipment : null);

    const rawResp = shipment?.provider_raw_response || {};
    const awbResp = rawResp.awb_response || {};
    const rawCarrierId = String(awbResp.carrier_id || rawResp.carrier_id || shipment?.service_type || '').trim();

    // Explicit Shipway carrier ID mapping
    const shipwayCarrierIdMap = {
      '7377': { carrier: 'BLUE DART', variant: 'EXPRESS' },
      '81769': { carrier: 'BLUE DART', variant: 'SURFACE' },
      '7442': { carrier: 'DELHIVERY', variant: 'EXPRESS' },
      '80622': { carrier: 'DELHIVERY', variant: 'SURFACE' },
      '80652': { carrier: 'XPRESSBEES', variant: 'EXPRESS' },
      '80593': { carrier: 'XPRESSBEES', variant: 'SURFACE' },
      '80800': { carrier: 'DTDC', variant: 'EXPRESS' },
      '79681': { carrier: 'SHADOWFAX', variant: 'SURFACE' },
      '82861': { carrier: 'EKART', variant: 'SURFACE' },
      '19339': { carrier: 'AMAZON', variant: 'SURFACE' },
    };

    if (shipwayCarrierIdMap[rawCarrierId]) {
      const match = shipwayCarrierIdMap[rawCarrierId];
      return `${match.carrier} • ${match.variant}`;
    }

    const allocatedCarrierName = awbResp.carrier_name || rawResp.carrier_name || awbResp.carrier_title || rawResp.carrier_title || null;
    const rawName = (allocatedCarrierName || provider?.display_name || provider?.provider_key || 'Delhivery').toLowerCase();
    let carrierName = 'COURIER';
    if (rawName.includes('st') || rawName.includes('tamil')) {
      carrierName = 'ST COURIER';
    } else if (rawName.includes('delhivery')) {
      carrierName = 'DELHIVERY';
    } else if (rawName.includes('blue') || rawName.includes('dart')) {
      carrierName = 'BLUE DART';
    } else if (rawName.includes('xpress')) {
      carrierName = 'XPRESSBEES';
    } else if (rawName.includes('ekart')) {
      carrierName = 'EKART';
    } else if (rawName.includes('shadowfax')) {
      carrierName = 'SHADOWFAX';
    } else if (rawName.includes('smartr')) {
      carrierName = 'SMARTR';
    } else if (rawName.includes('dtdc')) {
      carrierName = 'DTDC';
    } else if (rawName.includes('ecom')) {
      carrierName = 'ECOM EXPRESS';
    } else {
      carrierName = (allocatedCarrierName || provider?.display_name || 'EXPRESS').replace(/[()_]/g, ' ').replace(/\s+/g, ' ').slice(0, 16).toUpperCase().trim();
    }

    const fullServiceText = [
      awbResp.carrier_title,
      awbResp.carrier_name,
      rawResp.carrier_title,
      rawResp.carrier_name,
      shipment?.service_type,
    ].filter(Boolean).join(' ').toUpperCase();

    let serviceName = 'SURFACE';
    if (fullServiceText.includes('AIR')) {
      serviceName = 'AIR';
    } else if (fullServiceText.includes('EXP') || fullServiceText.includes('PRIORITY')) {
      serviceName = 'EXPRESS';
    } else if (fullServiceText.includes('SURFACE')) {
      serviceName = 'SURFACE';
    } else if (shipment?.service_type === 'express' || shipment?.service_type === 'air') {
      serviceName = 'EXPRESS';
    }

    return `${carrierName} • ${serviceName}`;
  }

  /**
   * Renders a single label content box inside specified bounding box coordinates.
   * Fully responsive and proportional across all standard shipping label dimensions.
   */
  async renderLabelBox(pdfDoc, page, bounds, data) {
    const { x, y, width, height } = bounds;
    const { shipment, order, provider, pickupAddress, tenant, settings, barcodeImage, qrImage, nanoshipyLogoImage, merchantLogoImage } = data;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const isCOD = (order.payment_mode || '').toLowerCase() === 'cod';
    const awb = String(shipment.awb_number || '11633334789122').trim();
    const orderRef = order.order_reference || (order.id ? `ORD-${order.id.slice(0, 8)}` : '291744');
    const invoiceNo = order.invoice_number || (settings?.invoice_prefix?.value ? `${settings.invoice_prefix.value}-${orderRef.replace(/[^0-9]/g, '').slice(-6) || '291744'}` : '291744');
    
    const courierBadge = this.getCleanCarrierBadge(provider, shipment);
    const companyName = tenant?.company_name || 'NanoShipy Merchant';
    const legalName = tenant?.legal_business_name || companyName;
    const gstin = tenant?.gst_number || tenant?.gstin || '33AABCW6108R1ZY';

    const isCompact = height < 320 || width < 250;
    const isVeryCompact = height < 290;

    const orderDateStr = this.formatLabelDate(order.created_at || new Date(), isCompact);
    const invoiceDateStr = this.formatLabelDate(order.created_at || new Date(), isCompact);

    const weightKg = shipment.declared_weight_kg || order.weight_kg || 0.5;
    const l = Math.round(shipment.length_cm || order.length_cm || 10);
    const w = Math.round(shipment.width_cm || order.width_cm || 10);
    const h = Math.round(shipment.height_cm || order.height_cm || 10);
    const pieces = order.pieces || order.quantity || (Array.isArray(order.items) ? order.items.length : 1);
    const codAmount = Number(order.cod_amount || order.order_value || 0);

    // Dynamic section heights based on available height (never overflows)
    const brandH = isVeryCompact ? 14 : (isCompact ? 16 : 18);
    const footerH = isVeryCompact ? 14 : (isCompact ? 16 : 18);
    const availableH = height - brandH - footerH;

    // Proportions
    const headerRatio = 0.22;
    const splitRatio = isVeryCompact ? 0.40 : 0.41;
    const payRatio = isVeryCompact ? 0.12 : 0.11;
    
    const headerH = Math.round(availableH * headerRatio);
    const splitH = Math.round(availableH * splitRatio);
    const payH = Math.round(availableH * payRatio);
    const retH = availableH - headerH - splitH - payH;

    const top = y + height;
    const headerY = top - brandH;
    const headerBottom = headerY - headerH;
    const splitBottom = headerBottom - splitH;
    const payBottom = splitBottom - payH;
    const retBottom = payBottom - retH;

    // 1. Outer Border
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.12, 0.12, 0.15),
      borderWidth: 1.2,
    });

    // 2. NanoShipy Header Brand Banner
    page.drawRectangle({
      x: x + 1,
      y: top - brandH,
      width: width - 2,
      height: brandH - 1,
      color: rgb(0.09, 0.04, 0.18), // NanoShipy Brand Deep Purple
    });

    if (nanoshipyLogoImage) {
      try {
        const logoSize = brandH - 5;
        page.drawImage(nanoshipyLogoImage, {
          x: x + 6,
          y: top - brandH + 2.5,
          width: logoSize,
          height: logoSize,
        });
      } catch (_) {}
    }

    const brandTextSize = isVeryCompact ? 6.5 : 7.5;
    page.drawText('NANOSHIPY EXPRESS', {
      x: x + (nanoshipyLogoImage ? 22 : 8),
      y: top - brandH + (brandH - brandTextSize) / 2 + 1,
      size: brandTextSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    if (width >= 260) {
      const ecoText = 'MULTI-CARRIER LOGISTICS ECOSYSTEM';
      const ecoSize = 5.5;
      const ecoWidth = fontBold.widthOfTextAtSize(ecoText, ecoSize);
      page.drawText(ecoText, {
        x: x + width - ecoWidth - 8,
        y: top - brandH + (brandH - ecoSize) / 2 + 1,
        size: ecoSize,
        font: fontBold,
        color: rgb(0.85, 0.75, 1),
      });
    }

    // 3. Header Section (Shipping Label + Barcode)
    const leftMargin = x + 8;
    if (merchantLogoImage) {
      try {
        const maxLogoW = Math.min(90, width * 0.35);
        const maxLogoH = Math.min(22, headerH * 0.35);
        const logoDims = merchantLogoImage.scaleToFit(maxLogoW, maxLogoH);
        page.drawImage(merchantLogoImage, {
          x: leftMargin,
          y: headerY - logoDims.height - 6,
          width: logoDims.width,
          height: logoDims.height,
        });
      } catch (_) {}
    }

    const shipLabelTitleSize = isVeryCompact ? 10 : (isCompact ? 11 : 13);
    const shipLabelY = merchantLogoImage 
      ? headerY - (isCompact ? 36 : 42)
      : headerY - (isCompact ? 22 : 28);

    page.drawText('Shipping Label', {
      x: leftMargin,
      y: shipLabelY,
      size: shipLabelTitleSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const maxCompNameLen = Math.floor((width * 0.45) / 5);
    page.drawText(companyName.slice(0, maxCompNameLen), {
      x: leftMargin,
      y: shipLabelY - (isCompact ? 10 : 13),
      size: isCompact ? 6.5 : 7.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });

    // Right side: Barcode + AWB + Courier Partner
    const bWidth = Math.min(125, Math.max(88, Math.round(width * 0.43)));
    const bHeight = Math.min(32, Math.max(20, Math.round(headerH * 0.40)));
    const bX = x + width - bWidth - 8;
    const bY = headerBottom + Math.round(headerH * 0.38);

    if (barcodeImage) {
      page.drawImage(barcodeImage, {
        x: bX,
        y: bY,
        width: bWidth,
        height: bHeight,
      });
    }

    // Centered AWB below barcode
    const awbSize = isVeryCompact ? 8.5 : (isCompact ? 9 : 10);
    const awbWidth = fontBold.widthOfTextAtSize(awb, awbSize);
    page.drawText(awb, {
      x: bX + (bWidth - awbWidth) / 2,
      y: bY - (isCompact ? 9 : 11),
      size: awbSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Courier partner name (Clean uppercase badge, auto-scaled to never overflow bWidth)
    let courierSize = isVeryCompact ? 6 : (isCompact ? 6.5 : 7.5);
    let courierWidth = fontBold.widthOfTextAtSize(courierBadge, courierSize);
    while (courierWidth > bWidth && courierSize > 5) {
      courierSize -= 0.5;
      courierWidth = fontBold.widthOfTextAtSize(courierBadge, courierSize);
    }
    page.drawText(courierBadge, {
      x: bX + Math.max(0, (bWidth - courierWidth) / 2),
      y: bY - (isCompact ? 18 : 22),
      size: courierSize,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Divider below header
    page.drawLine({
      start: { x, y: headerBottom },
      end: { x: x + width, y: headerBottom },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 4. Split 2-Column Section (SHIP TO + Order Details Table)
    const colSplitX = x + Math.round(width * 0.50);

    // Vertical line between columns
    page.drawLine({
      start: { x: colSplitX, y: headerBottom },
      end: { x: colSplitX, y: splitBottom },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
    });

    // --- Left Column: SHIP TO ---
    const leftColW = colSplitX - x - 12;
    page.drawText('SHIP TO:', {
      x: leftMargin,
      y: headerBottom - (isCompact ? 12 : 14),
      size: isCompact ? 7.5 : 8.5,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    const custName = (order.customer_name || 'Customer').trim();
    const custNameSize = isVeryCompact ? 9.5 : (isCompact ? 10.5 : 11.5);
    const maxCustChars = Math.floor(leftColW / 6.5);
    page.drawText(custName.slice(0, maxCustChars), {
      x: leftMargin,
      y: headerBottom - (isCompact ? 24 : 28),
      size: custNameSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    page.drawText('Address', {
      x: leftMargin,
      y: headerBottom - (isCompact ? 34 : 39),
      size: 6,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });

    const addr1 = order.shipping_address_line1 || '';
    const addr2 = order.shipping_address_line2 || '';
    const fullAddr = `${addr1}${addr2 && !addr1.includes(addr2) ? ', ' + addr2 : ''}`.trim();
    const maxAddrChars = Math.floor(leftColW / 4.2);
    const addrLines = this.wrapText(fullAddr, maxAddrChars);

    let curAddrY = headerBottom - (isCompact ? 44 : 50);
    const maxAddrLinesToShow = isVeryCompact ? 2 : (isCompact ? 2 : 3);
    addrLines.slice(0, maxAddrLinesToShow).forEach((al) => {
      page.drawText(al, {
        x: leftMargin,
        y: curAddrY,
        size: isCompact ? 6 : 6.5,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      curAddrY -= (isCompact ? 8 : 9.5);
    });

    const cityState = `${order.shipping_city || ''}${order.shipping_state ? ', ' + order.shipping_state : ''}`.trim();
    page.drawText(cityState.slice(0, maxAddrChars), {
      x: leftMargin,
      y: curAddrY,
      size: isCompact ? 6 : 6.5,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Prominent Destination Pincode Routing Badge
    const pincode = String(order.shipping_pincode || '600094').trim();
    const pinBoxY = splitBottom + (isVeryCompact ? 16 : (isCompact ? 20 : 26));
    const pinBoxH = isVeryCompact ? 18 : (isCompact ? 20 : 22);
    const pinBoxW = Math.min(leftColW, 110);

    page.drawRectangle({
      x: leftMargin,
      y: pinBoxY,
      width: pinBoxW,
      height: pinBoxH,
      borderColor: rgb(0.1, 0.1, 0.1),
      borderWidth: 1,
      color: rgb(0.96, 0.96, 0.98),
    });

    const pinLabelText = 'PIN: ';
    page.drawText(pinLabelText, {
      x: leftMargin + 5,
      y: pinBoxY + (pinBoxH - 8) / 2 + 1,
      size: 7,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    const pinValSize = isVeryCompact ? 10 : 11.5;
    page.drawText(pincode, {
      x: leftMargin + 25,
      y: pinBoxY + (pinBoxH - pinValSize) / 2 + 1,
      size: pinValSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Customer Phone
    if (order.customer_phone) {
      const phoneY = splitBottom + (isVeryCompact ? 5 : (isCompact ? 7 : 10));
      page.drawText(`Phone: ${order.customer_phone}`, {
        x: leftMargin,
        y: phoneY,
        size: isCompact ? 6 : 6.5,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });
    }

    // --- Right Column: Metadata Table Rows ---
    const rows = [
      { label: 'Order Date:', val: orderDateStr },
      { label: 'Invoice No:', val: String(invoiceNo) },
      { label: 'Invoice Date:', val: invoiceDateStr },
      { label: 'Pieces:', val: String(pieces) },
      { label: 'Weight:', val: `${weightKg} Kg` },
      { label: 'Dimensions:', val: `${l}x${w}x${h} cm` },
      { label: 'Order ID:', val: String(orderRef) },
    ];

    let curRowY = headerBottom;
    const rowHeight = splitH / rows.length;
    const rightColW = (x + width) - colSplitX - 12;

    rows.forEach((r, idx) => {
      const textY = curRowY - (rowHeight * 0.65);
      const rowFontSize = isVeryCompact ? 5.5 : (isCompact ? 6 : 6.5);

      page.drawText(r.label, {
        x: colSplitX + 6,
        y: textY,
        size: rowFontSize,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });

      // Scale value size if needed to never collide with label
      let valFontSize = rowFontSize;
      let valWidth = fontBold.widthOfTextAtSize(r.val, valFontSize);
      const maxValW = rightColW - font.widthOfTextAtSize(r.label, rowFontSize) - 8;
      while (valWidth > maxValW && valFontSize > 4.5) {
        valFontSize -= 0.5;
        valWidth = fontBold.widthOfTextAtSize(r.val, valFontSize);
      }

      page.drawText(r.val, {
        x: x + width - valWidth - 6,
        y: textY,
        size: valFontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      if (idx < rows.length - 1) {
        curRowY -= rowHeight;
        page.drawLine({
          start: { x: colSplitX, y: curRowY },
          end: { x: x + width, y: curRowY },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }
    });

    // Divider below split
    page.drawLine({
      start: { x, y: splitBottom },
      end: { x: x + width, y: splitBottom },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 5. Payment Mode Section (Clean 2-column layout)
    page.drawLine({
      start: { x: colSplitX, y: splitBottom },
      end: { x: colSplitX, y: payBottom },
      thickness: 0.8,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Left: Payment Mode Badge
    const payModeLabelY = payBottom + (payH - 7) / 2 + (isVeryCompact ? 0 : 4);
    page.drawText('Payment Mode:', {
      x: leftMargin,
      y: payModeLabelY,
      size: isCompact ? 6.5 : 7.5,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const badgeX = leftMargin + (isCompact ? 58 : 68);
    const badgeW = isCompact ? 42 : 50;
    const badgeH = isVeryCompact ? 14 : 16;
    const badgeY = payBottom + (payH - badgeH) / 2;

    if (isCOD) {
      page.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badgeW,
        height: badgeH,
        color: rgb(0.12, 0.12, 0.15),
        borderWidth: 0,
      });
      const codTextW = fontBold.widthOfTextAtSize('COD', 8);
      page.drawText('COD', {
        x: badgeX + (badgeW - codTextW) / 2,
        y: badgeY + (badgeH - 8) / 2 + 1,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    } else {
      page.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badgeW,
        height: badgeH,
        borderColor: rgb(0, 0.5, 0.2),
        borderWidth: 1,
        color: rgb(0.93, 0.98, 0.94),
      });
      const prepTextW = fontBold.widthOfTextAtSize('PREPAID', 7.5);
      page.drawText('PREPAID', {
        x: badgeX + (badgeW - prepTextW) / 2,
        y: badgeY + (badgeH - 7.5) / 2 + 1,
        size: 7.5,
        font: fontBold,
        color: rgb(0, 0.45, 0.15),
      });
    }

    // Right: Payment Action Instructions
    const rightPayW = (x + width) - colSplitX;
    if (isCOD) {
      let codTitle = `Collect Cash: Rs. ${codAmount.toFixed(2)}`;
      let codTitleSize = isVeryCompact ? 7.5 : (isCompact ? 8 : 9);
      let codTitleW = fontBold.widthOfTextAtSize(codTitle, codTitleSize);
      while (codTitleW > rightPayW - 8 && codTitleSize > 6) {
        codTitleSize -= 0.5;
        codTitleW = fontBold.widthOfTextAtSize(codTitle, codTitleSize);
      }
      page.drawText(codTitle, {
        x: colSplitX + Math.max(4, (rightPayW - codTitleW) / 2),
        y: payBottom + (payH * 0.56),
        size: codTitleSize,
        font: fontBold,
        color: rgb(0.8, 0.1, 0.1),
      });

      const words = this.numberToIndianWords(codAmount);
      const wordLines = this.wrapText(words, Math.floor(rightPayW / 4.5));
      let wordY = payBottom + (wordLines.length > 1 ? (payH * 0.34) : (payH * 0.25));
      wordLines.slice(0, 2).forEach((wl) => {
        let wlSize = 5.2;
        let wlW = font.widthOfTextAtSize(wl, wlSize);
        while (wlW > rightPayW - 8 && wlSize > 4) {
          wlSize -= 0.4;
          wlW = font.widthOfTextAtSize(wl, wlSize);
        }
        page.drawText(wl, {
          x: colSplitX + Math.max(4, (rightPayW - wlW) / 2),
          y: wordY,
          size: wlSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        wordY -= 6.5;
      });
    } else {
      const prepTitle = 'DO NOT COLLECT CASH';
      let prepTitleSize = isVeryCompact ? 6.8 : (isCompact ? 7.2 : 8.5);
      let prepTitleW = fontBold.widthOfTextAtSize(prepTitle, prepTitleSize);
      while (prepTitleW > rightPayW - 10 && prepTitleSize > 5.5) {
        prepTitleSize -= 0.4;
        prepTitleW = fontBold.widthOfTextAtSize(prepTitle, prepTitleSize);
      }
      page.drawText(prepTitle, {
        x: colSplitX + Math.max(5, (rightPayW - prepTitleW) / 2),
        y: payBottom + (payH * 0.55),
        size: prepTitleSize,
        font: fontBold,
        color: rgb(0, 0.45, 0.15),
      });

      const prepSub = 'Prepaid Shipment • Settled';
      let prepSubSize = isVeryCompact ? 4.8 : 5.8;
      let prepSubW = font.widthOfTextAtSize(prepSub, prepSubSize);
      while (prepSubW > rightPayW - 10 && prepSubSize > 4.2) {
        prepSubSize -= 0.3;
        prepSubW = font.widthOfTextAtSize(prepSub, prepSubSize);
      }
      page.drawText(prepSub, {
        x: colSplitX + Math.max(5, (rightPayW - prepSubW) / 2),
        y: payBottom + (payH * 0.22),
        size: prepSubSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    // Divider below Payment
    page.drawLine({
      start: { x, y: payBottom },
      end: { x: x + width, y: payBottom },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 6. Return Address Section
    page.drawText('Return Address:', {
      x: leftMargin,
      y: payBottom - (isCompact ? 12 : 14),
      size: isCompact ? 7.5 : 8.5,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    const retAddrStr = `${legalName}, ${pickupAddress?.address_line1 || ''}, ${pickupAddress?.city || ''}, ${pickupAddress?.state || ''}, ${pickupAddress?.pincode || ''}`;
    const retMaxChars = Math.floor((width - 65) / 4.5);
    const retLines = this.wrapText(retAddrStr, retMaxChars);

    let curRetY = payBottom - (isCompact ? 22 : 26);
    const maxRetLines = isVeryCompact ? 2 : (isCompact ? 2 : 3);
    retLines.slice(0, maxRetLines).forEach((line) => {
      page.drawText(line, {
        x: leftMargin,
        y: curRetY,
        size: isCompact ? 5.8 : 6.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      curRetY -= (isCompact ? 7.5 : 8.5);
    });

    // GSTIN
    page.drawText(`GSTIN : ${gstin}`, {
      x: leftMargin,
      y: retBottom + (isVeryCompact ? 6 : (isCompact ? 8 : 10)),
      size: isCompact ? 6.5 : 7.5,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // QR Code on right side of Return Address
    if (qrImage) {
      const qrSize = Math.min(38, Math.max(26, retH - 18));
      const qrX = x + width - qrSize - 10;
      const qrY = retBottom + (retH - qrSize) / 2 + 3;

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      const qrText = 'SCAN TO TRACK';
      const qrTextSize = 4.5;
      const qrTextW = fontBold.widthOfTextAtSize(qrText, qrTextSize);
      page.drawText(qrText, {
        x: qrX + (qrSize - qrTextW) / 2,
        y: qrY - 6,
        size: qrTextSize,
        font: fontBold,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    // Divider above footer
    page.drawLine({
      start: { x, y: retBottom },
      end: { x: x + width, y: retBottom },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 7. NanoShipy Brand Footer Badge (Vertically Centered)
    // 7. White-Label Shipping Label Footer
    page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: footerH - 1,
      color: rgb(0.96, 0.96, 0.98),
    });

    const footerTextSize = isVeryCompact ? 5.5 : 6.2;
    const storeBrand = tenant?.company_name || 'Standard Logistics Fulfillment';
    const footerBrand = `Standard Logistics Fulfillment • ${storeBrand}`;
    page.drawText(footerBrand, {
      x: x + 8,
      y: y + (footerH - footerTextSize) / 2 + 0.5,
      size: footerTextSize,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.35),
    });

    const awbFooter = `AWB: ${awb}`;
    const awbFooterWidth = fontBold.widthOfTextAtSize(awbFooter, footerTextSize);
    page.drawText(awbFooter, {
      x: x + width - awbFooterWidth - 8,
      y: y + (footerH - footerTextSize) / 2 + 0.5,
      size: footerTextSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.2),
    });
  }

  /**
   * Generates a custom PDF shipping label across multiple page formats.
   *
   * @param {object} shipment
   * @param {object} order
   * @param {object} provider
   * @param {object} pickupAddress
   * @param {string} [format='4x6'] - '4x6', '4x4', '3x5', 'a4', 'a4_4in1', 'a4_2in1', 'a6'
   * @returns {Promise<Buffer>} PDF Buffer
   */
  async renderCustomLabelPDF(shipment, order, provider, pickupAddress, format = '4x6') {
    const pdfDoc = await PDFDocument.create();

    // Generate Barcode image
    let barcodeImage = null;
    const awb = shipment.awb_number || 'AWB-PENDING';
    try {
      const barcodeBuffer = await this.generateBarcode(awb, 14);
      barcodeImage = await pdfDoc.embedPng(barcodeBuffer);
    } catch (err) {
      logger.warn(`Could not embed barcode on label: ${err.message}`);
    }

    // Generate QR code for tracking
    let qrImage = null;
    try {
      const trackingUrl = `https://nanoshipy.com/track?awb=${encodeURIComponent(awb)}`;
      const qrBuffer = await this.generateQRCode(trackingUrl);
      qrImage = await pdfDoc.embedPng(qrBuffer);
    } catch (err) {
      logger.warn(`Could not embed QR code on label: ${err.message}`);
    }

    // Fetch NanoShipy original logo
    let nanoshipyLogoImage = null;
    try {
      const candidatePaths = [
        path.join(__dirname, '..', 'assets', 'nanoshipy-logo.png'),
        '/var/www/Saas-Frontend/backend/src/assets/nanoshipy-logo.png',
        '/var/www/nanoshipy-landing/logo.png',
        '/var/www/Saas-Frontend/frontend/public/logo.png',
        path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'logo.png'),
        path.join(__dirname, '..', '..', '..', 'public', 'logo.png'),
      ];
      for (const cp of candidatePaths) {
        if (fs.existsSync(cp)) {
          const logoBuffer = fs.readFileSync(cp);
          nanoshipyLogoImage = await pdfDoc.embedPng(logoBuffer);
          break;
        }
      }
    } catch (err) {
      logger.warn(`Could not embed NanoShipy logo on label: ${err.message}`);
    }

    // Fetch tenant & merchant settings
    let tenant = null;
    let settings = null;
    try {
      if (order.tenant_id) {
        tenant = await Tenant.findByPk(order.tenant_id);
        const settingsService = require('./settings.service');
        settings = await settingsService.getAllSettings(order.tenant_id);
      }
    } catch (_) {}

    // Fetch merchant custom logo
    let merchantLogoImage = null;
    try {
      const merchantLogoUrl = settings?.label_logo_url?.value || settings?.label_logo_url || tenant?.logo_url;
      if (merchantLogoUrl) {
        let logoBuffer = null;
        if (merchantLogoUrl.startsWith('http://') || merchantLogoUrl.startsWith('https://')) {
          const response = await axios.get(merchantLogoUrl, { responseType: 'arraybuffer', timeout: 5000 });
          logoBuffer = Buffer.from(response.data);
        } else {
          const cleanP = merchantLogoUrl.replace(/^\//, '');
          const localPaths = [
            path.join(__dirname, '..', '..', cleanP),
            path.join(__dirname, '..', '..', 'uploads', cleanP),
            path.join('/var/www/Saas-Frontend/backend', cleanP),
          ];
          for (const lp of localPaths) {
            if (fs.existsSync(lp)) {
              logoBuffer = fs.readFileSync(lp);
              break;
            }
          }
        }

        if (logoBuffer) {
          try {
            merchantLogoImage = await pdfDoc.embedPng(logoBuffer);
          } catch (_) {
            merchantLogoImage = await pdfDoc.embedJpg(logoBuffer);
          }
        }
      }
    } catch (err) {
      logger.warn(`Could not embed merchant logo on label: ${err.message}`);
    }

    const data = {
      shipment,
      order,
      provider,
      pickupAddress,
      tenant,
      settings,
      barcodeImage,
      qrImage,
      nanoshipyLogoImage,
      merchantLogoImage,
    };

    const fmt = (format || '4x6').toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (fmt === 'a4_4in1') {
      const a4Width = 595.28;
      const a4Height = 841.89;
      const page = pdfDoc.addPage([a4Width, a4Height]);
      const margin = 20;
      const gap = 15;
      const labelW = (a4Width - (2 * margin) - gap) / 2; // ~270 pt
      const labelH = (a4Height - (2 * margin) - gap) / 2; // ~393 pt

      const positions = [
        { x: margin, y: a4Height - margin - labelH, width: labelW, height: labelH },                   // Top Left
        { x: margin + labelW + gap, y: a4Height - margin - labelH, width: labelW, height: labelH },   // Top Right
        { x: margin, y: margin, width: labelW, height: labelH },                                      // Bottom Left
        { x: margin + labelW + gap, y: margin, width: labelW, height: labelH },                       // Bottom Right
      ];

      for (const pos of positions) {
        await this.renderLabelBox(pdfDoc, page, pos, data);
      }
    } else if (fmt === 'a4_2in1') {
      const a4Width = 595.28;
      const a4Height = 841.89;
      const page = pdfDoc.addPage([a4Width, a4Height]);

      const labelW = 340;
      const labelH = 390;
      const labelX = (a4Width - labelW) / 2;
      const gap = 20;
      const topY = a4Height - 20 - labelH;
      const botY = topY - labelH - gap;

      await this.renderLabelBox(pdfDoc, page, { x: labelX, y: topY, width: labelW, height: labelH }, data);
      await this.renderLabelBox(pdfDoc, page, { x: labelX, y: botY, width: labelW, height: labelH }, data);
    } else if (fmt === 'a4') {
      const a4Width = 595.28;
      const a4Height = 841.89;
      const page = pdfDoc.addPage([a4Width, a4Height]);

      const boxW = 380;
      const boxH = 550;
      const boxX = (a4Width - boxW) / 2;
      const boxY = (a4Height - boxH) / 2;

      await this.renderLabelBox(pdfDoc, page, { x: boxX, y: boxY, width: boxW, height: boxH }, data);
    } else if (fmt === '4x4') {
      const width = 288;
      const height = 288;
      const page = pdfDoc.addPage([width, height]);
      await this.renderLabelBox(pdfDoc, page, { x: 6, y: 6, width: width - 12, height: height - 12 }, data);
    } else if (fmt === '3x5') {
      const width = 216;
      const height = 360;
      const page = pdfDoc.addPage([width, height]);
      await this.renderLabelBox(pdfDoc, page, { x: 5, y: 5, width: width - 10, height: height - 10 }, data);
    } else if (fmt === 'a6') {
      const width = 297.64;
      const height = 419.53;
      const page = pdfDoc.addPage([width, height]);
      await this.renderLabelBox(pdfDoc, page, { x: 6, y: 6, width: width - 12, height: height - 12 }, data);
    } else {
      // Default: 4 x 6 inch standard thermal label (288 x 432 pt)
      const width = 288;
      const height = 432;
      const page = pdfDoc.addPage([width, height]);
      await this.renderLabelBox(pdfDoc, page, { x: 6, y: 6, width: width - 12, height: height - 12 }, data);
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a shipping label for a shipment (custom rendering or provider fallback).
   *
   * @param {string} shipmentId - Shipment UUID
   * @param {string} [format='4x6'] - '4x6', '4x4', '3x5', 'a4', 'a4_4in1', 'a4_2in1', 'a6'
   * @param {boolean} [forceCustom=true] - Generate customized branded label with NanoShipy branding
   * @returns {Promise<string>} Uploaded Label URL
   */
  async generateLabelForShipment(shipmentId, format = '4x6', forceCustom = false, transaction = null) {
    const shipment = await Shipment.scope('detailed').findByPk(shipmentId, {
      include: [
        { model: Order, as: 'order' },
        { model: CourierProvider, as: 'provider' },
        {
          model: PickupAddress,
          as: 'pickupAddress',
          attributes: ['id', 'label', 'contact_name', 'contact_phone', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country', 'is_default', 'is_active'],
        },
      ],
      transaction,
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    const { order, provider, pickupAddress } = shipment;
    if (!order) {
      throw new NotFoundError('Associated order not found for label generation');
    }
    if (!provider) {
      throw new NotFoundError('Associated provider not found for label generation');
    }
    if (!pickupAddress) {
      throw new NotFoundError('Associated pickup address not found for label generation');
    }

    let pdfBuffer = null;

    // Always render custom high-precision label with NanoShipy branding & multi-format support
    logger.info(`Rendering professional branded shipping label for shipment ${shipmentId} (AWB: ${shipment.awb_number}) in format ${format}`);
    pdfBuffer = await this.renderCustomLabelPDF(shipment, order, provider, pickupAddress, format);

    // Upload to file storage
    const destinationPath = 'shipments/labels';
    const originalName = `${shipment.awb_number || shipmentId}_${format}.pdf`;
    const mimeType = 'application/pdf';

    const uploadedUrl = await fileUploadService.uploadFile(pdfBuffer, destinationPath, originalName, mimeType);

    // Save label URL in Shipment
    shipment.label_url = uploadedUrl;
    await shipment.save({ transaction });

    logger.info(`Successfully generated and stored shipping label URL for shipment ${shipmentId}: ${uploadedUrl}`);
    return uploadedUrl;
  }
}

module.exports = new LabelGenerationService();
