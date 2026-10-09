'use strict';

const taxCalculationService = require('../../src/services/taxCalculation.service');

describe('TaxCalculationService - Unit Tests', () => {
  const platformGstin = '33ABCDE1234F1Z5'; // Tamil Nadu (33)

  test('should successfully compute same-state CGST & SGST 50-50 splits', async () => {
    const subtotal = 100;
    const result = await taxCalculationService.calculateTax(subtotal, platformGstin, 'Tamil Nadu');

    expect(result.subtotal).toBe(100);
    expect(result.cgst_amount).toBe(9);
    expect(result.sgst_amount).toBe(9);
    expect(result.igst_amount).toBe(0);
    expect(result.total_amount).toBe(118);
    expect(result.isIntraState).toBe(true);
  });

  test('should successfully compute different-state IGST 18% splits', async () => {
    const subtotal = 100;
    const result = await taxCalculationService.calculateTax(subtotal, platformGstin, 'Maharashtra');

    expect(result.subtotal).toBe(100);
    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(18);
    expect(result.total_amount).toBe(118);
    expect(result.isIntraState).toBe(false);
  });

  test('should throw error when subtotal is negative', async () => {
    await expect(
      taxCalculationService.calculateTax(-50, platformGstin, 'Tamil Nadu')
    ).rejects.toThrow('Subtotal must be a positive number');
  });

  test('should throw error when subtotal is NaN', async () => {
    await expect(
      taxCalculationService.calculateTax('invalid-amt', platformGstin, 'Tamil Nadu')
    ).rejects.toThrow('Subtotal must be a positive number');
  });
});
