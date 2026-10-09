'use strict';

describe('Invoice PDF Safe Filename Unit Test (#29)', () => {
  it('correctly replaces forward and backward slashes in Content-Disposition', async () => {
    const mockInvoice = {
      id: 'inv-123',
      invoice_number: 'INV/2026-27/00192',
      pdf_url: null,
    };

    jest.doMock('../../src/repositories/invoice.repository', () => ({
      findById: jest.fn().mockResolvedValue(mockInvoice),
    }));

    jest.doMock('../../src/services/invoicePdf.service', () => ({
      generateInvoicePdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-1.4 mock') }),
    }));

    const invoiceController = require('../../src/controllers/invoice.controller');

    const req = {
      user: { tenant_id: 'tenant-1' },
      params: { id: 'inv-123' },
    };

    const headers = {};
    const res = {
      setHeader: jest.fn((key, val) => {
        headers[key] = val;
      }),
      send: jest.fn(),
    };
    const next = jest.fn();

    await invoiceController.getInvoicePdfStream(req, res, next);

    expect(headers['Content-Disposition']).toBe('inline; filename="invoice-INV-2026-27-00192.pdf"');
    expect(headers['Content-Disposition']).not.toContain('/');
    expect(headers['Content-Disposition']).not.toContain('\\');
  });
});
