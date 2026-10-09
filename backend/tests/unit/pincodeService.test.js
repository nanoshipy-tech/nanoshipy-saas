'use strict';

require('dotenv').config();
const pincodeService = require('../../src/services/pincode.service');

describe('Pincode Lookup Service Unit Tests', () => {
  it('should reject invalid pincodes with error message', async () => {
    const res = await pincodeService.lookupPincode('123');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid 6-digit');
  });

  it('should successfully resolve 110001 (New Delhi)', async () => {
    const res = await pincodeService.lookupPincode('110001');
    expect(res.success).toBe(true);
    expect(res.data.pincode).toBe('110001');
    expect(res.data.state).toBe('Delhi');
  });

  it('should return cached result on second query', async () => {
    await pincodeService.lookupPincode('400001');
    const res2 = await pincodeService.lookupPincode('400001');
    expect(res2.success).toBe(true);
    expect(res2.cached).toBe(true);
  });
});
