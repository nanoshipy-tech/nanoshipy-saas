'use strict';

// 1. Setup models and service mocks first
jest.mock('../../src/models', () => {
  const mockTx = {
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
    LOCK: { UPDATE: 'UPDATE' },
  };
  return {
    Invoice: {
      findOne: jest.fn(),
    },
    CreditNote: {
      findOne: jest.fn(),
      create: jest.fn(),
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
jest.mock('../../src/services/invoiceNumbering.service');

// 2. Import service after mocks are registered
const creditNoteService = require('../../src/services/creditNote.service');
const { CreditNote, Invoice } = require('../../src/models');
const invoiceNumberingService = require('../../src/services/invoiceNumbering.service');

describe('CreditNoteService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should successfully generate credit note on shipment cancellation', async () => {
    const mockInvoice = {
      id: 'invoice-123',
      tenant_id: 'tenant-abc',
      total_amount: 105.62,
    };

    Invoice.findOne.mockResolvedValue(mockInvoice);
    CreditNote.findOne.mockResolvedValue(null); // No existing credit note

    invoiceNumberingService.generateNextNumber.mockResolvedValue('CN/2026-27/000001');
    CreditNote.create.mockResolvedValue({
      id: 'cn-123',
      credit_note_number: 'CN/2026-27/000001',
      amount: 105.62,
    });

    const cn = await creditNoteService.createCancellationCreditNote('shipment-123', 'Customer request cancellation');

    expect(cn).toBeDefined();
    expect(cn.id).toBe('cn-123');
    expect(CreditNote.create).toHaveBeenCalled();
  });

  test('should return existing credit note if already generated (idempotency check)', async () => {
    const mockInvoice = {
      id: 'invoice-123',
      tenant_id: 'tenant-abc',
      total_amount: 105.62,
    };

    const mockExistingCN = {
      id: 'cn-already-exists',
      credit_note_number: 'CN/2026-27/000001',
    };

    Invoice.findOne.mockResolvedValue(mockInvoice);
    CreditNote.findOne.mockResolvedValue(mockExistingCN);

    const cn = await creditNoteService.createCancellationCreditNote('shipment-123', 'Duplicate cancelled request');

    expect(cn).toBeDefined();
    expect(cn.id).toBe('cn-already-exists');
    expect(CreditNote.create).not.toHaveBeenCalled();
  });
});
