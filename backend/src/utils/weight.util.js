'use strict';

/**
 * Standardized Weight Calculation Utility for Shipping SaaS
 * Formula: Volumetric Weight (kg) = (Length (cm) * Width (cm) * Height (cm)) / 5000
 */

/**
 * Calculates volumetric weight in kg based on dimensions in cm.
 * @param {number} lengthCm 
 * @param {number} widthCm 
 * @param {number} heightCm 
 * @returns {number} Volumetric weight rounded to 3 decimal places
 */
function calculateVolumetricWeight(lengthCm, widthCm, heightCm) {
  const l = parseFloat(lengthCm) || 0;
  const w = parseFloat(widthCm) || 0;
  const h = parseFloat(heightCm) || 0;
  const volWeight = (l * w * h) / 5000;
  return Math.round(volWeight * 1000) / 1000;
}

/**
 * Calculates billable weight in kg (max of actual and volumetric weight).
 * @param {number} actualWeightKg 
 * @param {number} lengthCm 
 * @param {number} widthCm 
 * @param {number} heightCm 
 * @returns {number} Billable weight rounded to 3 decimal places
 */
function calculateBillableWeight(actualWeightKg, lengthCm, widthCm, heightCm) {
  const actual = Math.round((parseFloat(actualWeightKg) || 0) * 1000) / 1000;
  const volumetric = calculateVolumetricWeight(lengthCm, widthCm, heightCm);
  return Math.max(actual, volumetric);
}

/**
 * Formats a numeric weight in kg to a standardized 3-decimal string (e.g. "0.500").
 * @param {number|string} weightKg 
 * @returns {string} Formatted weight string
 */
function formatWeight(weightKg) {
  const num = parseFloat(weightKg) || 0;
  return num.toFixed(3);
}

module.exports = {
  calculateVolumetricWeight,
  calculateBillableWeight,
  formatWeight,
};
