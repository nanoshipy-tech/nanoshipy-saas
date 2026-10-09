'use strict';

const { Op } = require('sequelize');

jest.mock('../../src/config/db.config', () => {
  const mockTransactionObj = {
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
  };
  return {
    transaction: jest.fn(async () => mockTransactionObj),
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

jest.mock('../../src/models', () => {
  const mockNdrEventCreate = jest.fn();
  const mockNdrEventFindOne = jest.fn();
  const mockNdrEventCount = jest.fn();
  const mockNdrEventFindAll = jest.fn();
  const mockNdrEventUpdate = jest.fn();

  const mockNdrActionCreate = jest.fn();

  const mockRtoRecordCreate = jest.fn();
  const mockRtoRecordFindOne = jest.fn();
  const mockRtoRecordFindAll = jest.fn();

  const mockShipmentFindByPk = jest.fn();
  const mockShipmentFindOne = jest.fn();
  const mockShipmentUpdate = jest.fn();

  return {
    sequelize: {
      transaction: jest.fn(async () => ({
        commit: jest.fn(),
        rollback: jest.fn(),
      })),
      fn: jest.fn((name, col) => col),
      col: jest.fn((c) => c),
    },
    NdrEvent: {
      create: mockNdrEventCreate,
      findOne: mockNdrEventFindOne,
      count: mockNdrEventCount,
      findAll: mockNdrEventFindAll,
      update: mockNdrEventUpdate,
    },
    NdrAction: {
      create: mockNdrActionCreate,
    },
    RtoRecord: {
      create: mockRtoRecordCreate,
      findOne: mockRtoRecordFindOne,
      findAll: mockRtoRecordFindAll,
    },
    Shipment: {
      findByPk: mockShipmentFindByPk,
      findOne: mockShipmentFindOne,
      update: mockShipmentUpdate,
    },
    CourierProvider: {
      scope: jest.fn(() => ({
        findOne: jest.fn(),
      })),
    },
  };
});

const ndrService = require('../../src/services/ndr.service');
const { NdrEvent, NdrAction, RtoRecord, Shipment } = require('../../src/models');
const shipmentStatusService = require('../../src/services/shipmentStatus.service');
const auditService = require('../../src/services/audit.service');

jest.mock('../../src/services/shipmentStatus.service', () => ({
  logHistory: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/providerCredential.service', () => ({
  decrypt: jest.fn().mockReturnValue({}),
}));

describe('NdrService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('takeNdrAction', () => {
    it('should successfully record reattempt action and transition NDR status', async () => {
      const mockNdr = {
        id: 'ndr-123',
        shipment_id: 'shipment-123',
        status: 'open',
        shipment: {
          id: 'shipment-123',
          awb_number: 'MOCK-123',
          status: 'out_for_delivery',
          provider: { provider_key: 'mock' },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      NdrEvent.findOne.mockResolvedValue(mockNdr);
      NdrAction.create.mockResolvedValue({ id: 'action-1' });

      const result = await ndrService.takeNdrAction('ndr-123', 'tenant-123', 'user-123', {
        action_type: 'reattempt',
        notes: 'Please try again tomorrow',
      });

      expect(NdrEvent.findOne).toHaveBeenCalled();
      expect(NdrAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'reattempt',
          notes: 'Please try again tomorrow',
          performed_by: 'user-123',
        }),
        expect.any(Object)
      );
      expect(mockNdr.update).toHaveBeenCalledWith({ status: 'action_taken' }, expect.any(Object));
      expect(result.status).toBe('action_taken');
    });

    it('should manually mark NDR for RTO, initiate RTO Record, and cancel parent shipment', async () => {
      const mockShipment = {
        id: 'shipment-123',
        status: 'out_for_delivery',
        update: jest.fn().mockResolvedValue(true),
      };

      const mockNdr = {
        id: 'ndr-123',
        shipment_id: 'shipment-123',
        status: 'open',
        shipment: mockShipment,
        update: jest.fn().mockResolvedValue(true),
      };

      NdrEvent.findOne.mockResolvedValue(mockNdr);
      NdrAction.create.mockResolvedValue({ id: 'action-1' });
      RtoRecord.create.mockResolvedValue({ id: 'rto-1' });

      const result = await ndrService.takeNdrAction('ndr-123', 'tenant-123', 'user-123', {
        action_type: 'mark_rto',
        notes: 'Undeliverable return to origin',
      });

      expect(RtoRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shipment_id: 'shipment-123',
          initiated_by: 'manual',
          status: 'rto_initiated',
        }),
        expect.any(Object)
      );
      expect(mockShipment.update).toHaveBeenCalledWith({ status: 'cancelled' }, expect.any(Object));
      expect(shipmentStatusService.logHistory).toHaveBeenCalled();
      expect(result.status).toBe('resolved_rto');
      expect(result.rto_record_id).toBeDefined();
    });

    it('should reject actions if NDR is already resolved', async () => {
      const mockNdr = {
        id: 'ndr-123',
        status: 'resolved_delivered',
      };

      NdrEvent.findOne.mockResolvedValue(mockNdr);

      await expect(
        ndrService.takeNdrAction('ndr-123', 'tenant-123', 'user-123', {
          action_type: 'reattempt',
        })
      ).rejects.toThrow();
    });
  });

  describe('takeBulkNdrAction', () => {
    it('should process actions sequentially and report processed vs failed counts', async () => {
      const mockNdr = {
        id: 'ndr-123',
        status: 'open',
        shipment: { id: 'ship-1', status: 'ofd' },
        update: jest.fn().mockResolvedValue(true),
      };

      NdrEvent.findOne.mockResolvedValue(mockNdr);
      NdrAction.create.mockResolvedValue({});

      const result = await ndrService.takeBulkNdrAction('tenant-123', 'user-123', {
        ndr_ids: ['ndr-1', 'ndr-2'],
        action_type: 'reattempt',
        notes: 'Bulk attempt',
      });

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });
  });
});
