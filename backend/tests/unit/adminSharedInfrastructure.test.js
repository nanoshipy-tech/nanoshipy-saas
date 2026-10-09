'use strict';

const assert = require('assert');
const { toCsv, toXlsx, generateExport } = require('../../src/utils/adminExport.util');
const { logAdminAction } = require('../../src/utils/adminAudit.helper');
const { ValidationError: AppValidationError } = require('../../src/utils/errors');
const errorHandler = require('../../src/middlewares/errorHandler.middleware');

describe('Phase 4: Shared Infrastructure Utilities', () => {
  describe('adminExport.util', () => {
    const columns = [
      { key: 'id', label: 'Order ID' },
      { key: 'customer', label: 'Customer Name' },
      { key: 'amount', label: 'Amount (INR)' },
    ];
    const data = [
      { id: 'ORD-001', customer: 'John Doe', amount: 1250.50 },
      { id: 'ORD-002', customer: 'Jane "Quoted" Smith', amount: 990.00 },
    ];

    it('should generate valid RFC 4180 CSV string with proper escaping', () => {
      const csv = toCsv(data, columns);
      assert(csv.includes('"Order ID","Customer Name","Amount (INR)"'));
      assert(csv.includes('"ORD-001","John Doe","1250.5"'));
      assert(csv.includes('"ORD-002","Jane ""Quoted"" Smith","990"'));
    });

    it('should generate XLSX binary buffer', () => {
      const xlsxBuffer = toXlsx(data, columns, 'Orders');
      assert(Buffer.isBuffer(xlsxBuffer));
      assert(xlsxBuffer.length > 0);
    });

    it('should generateExport with correct mimeTypes and extensions', () => {
      const csvResult = generateExport({ data, columns, format: 'csv' });
      assert.strictEqual(csvResult.extension, 'csv');
      assert.strictEqual(csvResult.mimeType, 'text/csv; charset=utf-8');

      const xlsxResult = generateExport({ data, columns, format: 'xlsx' });
      assert.strictEqual(xlsxResult.extension, 'xlsx');
      assert.strictEqual(xlsxResult.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });

  describe('adminAudit.helper', () => {
    it('should safely execute logAdminAction without throwing even if DB or adminId fails', async () => {
      const result = await logAdminAction({
        adminId: null,
        action: 'test_action',
        metadata: { key: 'val' },
      });
      // Should not throw; returns created log or null
      assert(result !== undefined);
    });
  });

  describe('errorHandler.middleware with AppValidationError', () => {
    it('should return HTTP 400 for AppValidationError instead of 500', () => {
      const customErr = new AppValidationError('Invalid input fields', { field1: 'Required' });
      let statusCalled = null;
      let jsonCalled = null;

      const mockRes = {
        status: (code) => {
          statusCalled = code;
          return mockRes;
        },
        json: (data) => {
          jsonCalled = data;
          return mockRes;
        },
      };

      errorHandler(customErr, { path: '/test', method: 'POST' }, mockRes, () => {});

      assert.strictEqual(statusCalled, 400);
      assert.strictEqual(jsonCalled.success, false);
      assert.strictEqual(jsonCalled.error.message, 'Invalid input fields');
    });
  });
});
