'use strict';

function formatINR(amount) {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  const isNegative = num < 0;
  const formatted = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNegative ? '-₹' : '₹') + formatted;
}

describe('formatINR Currency Formatter Unit Test (#38)', () => {
  it('formats positive numbers with ₹ prefix', () => {
    expect(formatINR(1250)).toBe('₹1,250.00');
    expect(formatINR(99.9)).toBe('₹99.90');
  });

  it('formats negative numbers as -₹amount (not ₹-amount)', () => {
    expect(formatINR(-45)).toBe('-₹45.00');
    expect(formatINR(-150.75)).toBe('-₹150.75');
    expect(formatINR('-45.50')).toBe('-₹45.50');
  });

  it('formats zero and empty inputs', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR('')).toBe('₹0.00');
    expect(formatINR(null)).toBe('₹0.00');
  });
});
