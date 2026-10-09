'use strict';

const config = require('../config/env');
const settingsService = require('./settings.service');

const STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/**
 * Calculates GST splits for shipping spend.
 * @param {number} subtotal
 * @param {string} billingGstin - platform GSTIN (e.g. 33ABCDE1234F1Z5)
 * @param {string} placeOfSupplyState - tenant state (e.g. 'Tamil Nadu')
 * @param {string|null} [tenantId=null] - optional, used for three-tier GST rate resolution
 */
async function calculateTax(subtotal, billingGstin, placeOfSupplyState, tenantId = null) {
  const amt = parseFloat(subtotal);
  if (isNaN(amt) || amt < 0) {
    throw new Error('Subtotal must be a positive number');
  }

  // Retrofit (Module 18): resolve GST rate via three-tier settings resolution.
  // Checks tenant override → platform_settings.default_gst_rate_percent → env GST_RATE_PERCENT.
  const { value: gstPercent } = await settingsService.getEffectiveSetting(tenantId, 'default_gst_rate_percent');
  const gstRate = gstPercent / 100;

  // Extract first 2 digits (state code) from GSTIN
  const billingStateCode = billingGstin ? billingGstin.substring(0, 2) : '33'; // Default to Tamil Nadu
  const billingStateName = STATE_CODES[billingStateCode] || config.billing.entityState;

  // Compare states case-insensitively
  const isIntraState = billingStateName.toLowerCase().trim() === placeOfSupplyState.toLowerCase().trim();

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  const totalGstAmount = Math.round(amt * gstRate * 100) / 100;

  if (isIntraState) {
    // 50-50 split for CGST and SGST
    cgst = Math.round((totalGstAmount / 2) * 100) / 100;
    sgst = Math.round((totalGstAmount / 2) * 100) / 100;
  } else {
    // 100% split to IGST
    igst = totalGstAmount;
  }

  const totalAmount = Math.round((amt + cgst + sgst + igst) * 100) / 100;

  return {
    subtotal: amt,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: igst,
    total_amount: totalAmount,
    isIntraState,
  };
}

/**
 * Synchronous GST computation helper for line items and freight receipts.
 */
function computeGST(amount, placeOfSupplyState = 'Tamil Nadu', gstPercent = 18) {
  const amt = parseFloat(amount) || 0;
  const billingState = (config.billing?.entityState || 'Tamil Nadu').toLowerCase().trim();
  const supplyState = (placeOfSupplyState || 'Tamil Nadu').toLowerCase().trim();
  const isIntraState = billingState === supplyState;

  const totalGst = Math.round(amt * (gstPercent / 100) * 100) / 100;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;

  if (isIntraState) {
    cgst = Math.round((totalGst / 2) * 100) / 100;
    sgst = Math.round((totalGst / 2) * 100) / 100;
    cgstRate = gstPercent / 2;
    sgstRate = gstPercent / 2;
  } else {
    igst = totalGst;
    igstRate = gstPercent;
  }

  return {
    total: totalGst,
    cgst,
    sgst,
    igst,
    cgstRate,
    sgstRate,
    igstRate,
    isIntraState,
  };
}

module.exports = {
  calculateTax,
  computeGST,
  STATE_CODES,
};
