'use strict';

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
  const mockRtoRecordFindOne = jest.fn();
  const mockRtoRecordUpdate = jest.fn();
  const mockNdrEventUpdate = jest.fn();

  return {
    sequelize: {
      transaction: jest.fn(async () => ({
        commit: jest.fn(),
        rollback: jest.fn(),
      })),
    },
    RtoRecord: {
      findOne: mockRtoRecordFindOne,
    },
    NdrEvent: {
      update: mockNdrEventUpdate,
    },
    Shipment: {},
  };
});

const rtoService = require('../../src/services/rto.service');
const { RtoRecord, NdrEvent } = require('../../src/models');
const shipmentStatusService = require('../../src/services/shipmentStatus.service');
const auditService = require('../../src/services/audit.service');

jest.mock('../../src/services/shipmentStatus.service', () => ({
  logHistory: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true),
}));

describe('RtoService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateRtoStatus', () => {
    it('should successfully update RTO status to delivered and complete warehousing checkin', async () => {
      const mockShipment = {
        id: 'ship-1',
        status: 'cancelled',
        update: jest.fn().mockResolvedValue(true),
      };

      const mockRto = {
        id: 'rto-123',
        shipment_id: 'ship-1',
        status: 'rto_in_transit',
        initiated_reason: 'Unreachable customer',
        shipment: mockShipment,
        update: jest.fn().mockResolvedValue(true),
      };

      RtoRecord.findOne.mockResolvedValue(mockRto);
      NdrEvent.update.mockResolvedValue([1]);

      const result = await rtoService.updateRtoStatus('rto-123', 'tenant-123', 'user-123', {
        status: 'rto_delivered',
        notes: 'Boxes received back and validated in inventory',
      });

      expect(RtoRecord.findOne).toHaveBeenCalled();
      expect(mockRto.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rto_delivered',
          received_at_warehouse_at: expect.any(Date),
        }),
        expect.any(Object)
      );
      expect(NdrEvent.update).toHaveBeenCalledWith(
        { status: 'resolved_rto' },
        expect.objectContaining({
          where: { shipment_id: 'ship-1', status: 'open' },
        })
      );
      expect(shipmentStatusService.logHistory).toHaveBeenCalledWith(
        'ship-1',
        'cancelled',
        'rto_delivered',
        'manual',
        'Boxes received back and validated in inventory',
        expect.any(Object)
      );
    });

    it('should reject invalid statuses', async () => {
      await expect(
        rtoService.updateRtoStatus('rto-123', 'tenant-123', 'user-123', {
          status: 'invalid_status_code',
        })
      ).rejects.toThrow();
    });
  });
});
