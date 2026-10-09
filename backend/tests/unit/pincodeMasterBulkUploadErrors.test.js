'use strict';

const adminPincodeMasterController = require('../../src/controllers/adminPincodeMaster.controller');

describe('Pincode Master CSV Bulk Upload Error Details Unit Test (#32)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns HTTP 422 with line numbers and specific errors when invalid rows exist', async () => {
    req.body = {
      rows: [
        { rowNumber: 1, data: { pincode: '110001', district: 'New Delhi', state: 'Delhi' } },
        { rowNumber: 2, data: { pincode: 'ABC123', district: 'Bengaluru', state: 'Karnataka' } },
        { rowNumber: 3, data: { pincode: '400001', district: '', state: 'Maharashtra' } },
      ],
    };

    await adminPincodeMasterController.uploadPincodes(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_FAILED',
          total_errors: 2,
          details: expect.arrayContaining([
            expect.objectContaining({ line: 2, pincode: 'ABC123', errors: ['Pincode must be exactly 6 digits'] }),
            expect.objectContaining({ line: 3, errors: ['District is required'] }),
          ]),
        }),
      })
    );
  });
});
