const { isValidIndianPincode } = require('../../src/utils/pincode.util');

describe('Pincode Utility Unit Tests', () => {
  describe('isValidIndianPincode', () => {
    it('should return true for valid 6-digit Indian PIN codes', () => {
      expect(isValidIndianPincode('110001')).toBe(true);
      expect(isValidIndianPincode('400001')).toBe(true);
      expect(isValidIndianPincode('600001')).toBe(true);
      expect(isValidIndianPincode('560001')).toBe(true);
      expect(isValidIndianPincode('700001')).toBe(true);
    });

    it('should return false for invalid PIN codes', () => {
      // Less than 6 digits
      expect(isValidIndianPincode('12345')).toBe(false);
      // More than 6 digits
      expect(isValidIndianPincode('1234567')).toBe(false);
      // Contains letters
      expect(isValidIndianPincode('11000A')).toBe(false);
      // Starts with zero (invalid in India)
      expect(isValidIndianPincode('011001')).toBe(false);
      // Empty string
      expect(isValidIndianPincode('')).toBe(false);
      // Non-string/numeric representation check (handled by JS regex test coercing if passed, but typically called with string)
      expect(isValidIndianPincode('11-001')).toBe(false);
    });
  });
});

describe('GSTIN Validation Regex Tests', () => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  it('should match valid Indian GSTIN numbers', () => {
    // Standard format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
    expect(gstinRegex.test('22AAAAA1111A1Z1')).toBe(true);
    expect(gstinRegex.test('07AAAAA1111A1Z2')).toBe(true);
  });

  it('should reject invalid GSTIN formats', () => {
    // Incorrect state code
    expect(gstinRegex.test('AAA5A1111A1Z1')).toBe(false);
    // Missing character 'Z'
    expect(gstinRegex.test('22AAAAA1111A1A1')).toBe(false);
    // Too short
    expect(gstinRegex.test('22AAAAA1111')).toBe(false);
    // Contains lowercase characters (pattern restricts to A-Z)
    expect(gstinRegex.test('22aaaaa1111a1z1')).toBe(false);
  });
});
