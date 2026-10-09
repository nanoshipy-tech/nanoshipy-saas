'use strict';

// 1. Setup mocks first
jest.mock('../../src/models', () => {
  const mockTx = {
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
    LOCK: { UPDATE: 'UPDATE' },
  };
  return {
    Invoice: {
      findOne: jest.fn(),
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    InvoiceLineItem: {
      create: jest.fn(),
    },
    Shipment: {
      findByPk: jest.fn(),
    },
    Tenant: {
      findByPk: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') return cb(mockTx);
        return mockTx;
      }),
    },
  };
});

jest.mock('../../src/services/taxCalculation.service');
jest.mock('../../src/services/invoiceNumbering.service');
jest.mock('../../src/services/invoicePdf.service');

// 2. Import service under test after mocks are registered
const invoiceService = require('../../src/services/invoice.service');
const { Invoice, InvoiceLineItem, Shipment, Tenant } = require('../../src/models');
const taxCalculationService = require('../../src/services/taxCalculation.service');
const invoiceNumberingService = require('../../src/services/invoiceNumbering.service');
const invoicePdfService = require('../../src/services/invoicePdf.service');

describe('InvoiceService - Unit & Resilience Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should successfully generate database invoice and lines on shipment creation', async () => {
    // Setup mock returns
    const mockShipment = {
      id: 'shipment-123',
      selected_rate: '89.50',
      awb_number: 'AWB987654321',
      tenant: {
        id: 'tenant-abc',
        company_state: 'Tamil Nadu',
      },
    };

    Shipment.findByPk.mockResolvedValue(mockShipment);
    Invoice.findOne.mockResolvedValue(null); // No existing invoice

    taxCalculationService.calculateTax.mockReturnValue({
      subtotal: 89.50,
      cgst_amount: 8.06,
      sgst_amount: 8.06,
      igst_amount: 0.00,
      total_amount: 105.62,
    });

    const fy = '2026-27';
    invoiceNumberingService.generateNextNumber.mockResolvedValue(`INV/${fy}/000123`);

    const mockInvoiceInstance = {
      id: 'invoice-uuid',
      invoice_number: `INV/${fy}/000123`,
      total_amount: 105.62,
    };
    Invoice.create.mockResolvedValue(mockInvoiceInstance);
    InvoiceLineItem.create.mockResolvedValue({});

    // Spy on PDF generation (should run in background)
    const pdfSpy = jest.spyOn(invoiceService, 'generateAndDeliverPdf').mockResolvedValue(null);

    // Call Service
    const invoice = await invoiceService.createShipmentInvoice('shipment-123');

    // Assertions
    expect(invoice).toBeDefined();
    expect(invoice.id).toBe('invoice-uuid');
    expect(Invoice.create).toHaveBeenCalled();
    expect(InvoiceLineItem.create).toHaveBeenCalled();

    pdfSpy.mockRestore();
  });

  test('should catch invoice errors and return null (non-blocking simulation check)', async () => {
    // Force a failure in finding shipment
    Shipment.findByPk.mockRejectedValue(new Error('DB Query crash'));

    // Try generating invoice
    const result = await invoiceService.createShipmentInvoice('shipment-123');

    // Verify it doesn't crash the server and returns null
    expect(result).toBeNull();
  });
});
