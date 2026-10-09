'use strict';

jest.mock('../../src/models', () => {
  return {
    InvoiceSequence: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
  };
});

const invoiceNumberingService = require('../../src/services/invoiceNumbering.service');

describe('InvoiceNumberingService - Unit Tests', () => {
  
  test('should return correct financial year representation for dates', () => {
    const aprDate = new Date(2026, 3, 1);
    expect(invoiceNumberingService.getFinancialYear(aprDate)).toBe('2026-27');

    const marDate = new Date(2026, 2, 31);
    expect(invoiceNumberingService.getFinancialYear(marDate)).toBe('2025-26');
  });

  test('should allocate correct invoice sequence formatted values', async () => {
    const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
    const { InvoiceSequence } = require('../../src/models');
    
    const mockSeqInstance = {
      last_number: 12,
      update: jest.fn().mockImplementation(function (data) {
        this.last_number = data.last_number;
        return this;
      }),
    };

    InvoiceSequence.findOne.mockResolvedValue(mockSeqInstance);
    InvoiceSequence.create.mockResolvedValue(mockSeqInstance);

    const invoiceNum = await invoiceNumberingService.generateNextNumber('invoice', mockTransaction);
    const fy = invoiceNumberingService.getFinancialYear();

    expect(invoiceNum).toBe(`INV/${fy}/000013`);
    expect(mockSeqInstance.update).toHaveBeenCalledWith({ last_number: 13 }, { transaction: mockTransaction });
  });
});
