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
  const mockTrackingEventFindByPk = jest.fn();

  const mockNdrEventCreate = jest.fn();
  const mockNdrEventFindOne = jest.fn();
  const mockNdrEventUpdate = jest.fn();

  const mockRtoRecordCreate = jest.fn();
  const mockRtoRecordFindOne = jest.fn();

  const mockShipmentUpdate = jest.fn();

  return {
    sequelize: {
      transaction: jest.fn(async () => ({
        commit: jest.fn(),
        rollback: jest.fn(),
      })),
    },
    TrackingEvent: {
      findByPk: mockTrackingEventFindByPk,
    },
    NdrEvent: {
      create: mockNdrEventCreate,
      findOne: mockNdrEventFindOne,
      update: mockNdrEventUpdate,
    },
    RtoRecord: {
      create: mockRtoRecordCreate,
      findOne: mockRtoRecordFindOne,
    },
    Shipment: {},
    TenantSetting: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    PlatformSetting: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    },
    SettingsChangeHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
});

const ndrDetectionService = require('../../src/services/ndrDetection.service');
const { TrackingEvent, NdrEvent, RtoRecord } = require('../../src/models');
const shipmentStatusService = require('../../src/services/shipmentStatus.service');
const auditService = require('../../src/services/audit.service');

jest.mock('../../src/services/shipmentStatus.service', () => ({
  logHistory: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true),
}));

describe('NdrDetectionService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-create a new open NDR event when delivery exception is detected', async () => {
    const mockEvent = {
      id: 'event-123',
      status: 'failed_attempt',
      remark: 'consignee absent from address',
      shipment: {
        id: 'shipment-123',
        tenant_id: 'tenant-123',
        status: 'out_for_delivery',
      },
    };

    TrackingEvent.findByPk.mockResolvedValue(mockEvent);
    NdrEvent.findOne.mockResolvedValue(null);
    NdrEvent.create.mockResolvedValue({ id: 'ndr-1' });

    await ndrDetectionService.detectAndProcessNdrOrRto('event-123');

    expect(TrackingEvent.findByPk).toHaveBeenCalledWith('event-123', expect.any(Object));
    expect(NdrEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment_id: 'shipment-123',
        reason_code: 'CUSTOMER_UNAVAILABLE',
        attempt_number: 1,
        status: 'open',
      }),
      expect.any(Object)
    );
  });

  it('should increment attempt_number if an open NDR already exists for the shipment', async () => {
    const mockEvent = {
      id: 'event-124',
      status: 'undelivered',
      remark: 'door closed',
      shipment: {
        id: 'shipment-123',
        tenant_id: 'tenant-123',
        status: 'out_for_delivery',
      },
    };

    const mockNdr = {
      id: 'ndr-1',
      attempt_number: 1,
      status: 'open',
      update: jest.fn().mockResolvedValue(true),
    };

    TrackingEvent.findByPk.mockResolvedValue(mockEvent);
    NdrEvent.findOne.mockResolvedValue(mockNdr);

    await ndrDetectionService.detectAndProcessNdrOrRto('event-124');

    expect(mockNdr.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt_number: 2,
        tracking_event_id: 'event-124',
      }),
      expect.any(Object)
    );
  });

  it('should auto-trigger RTO if attempt_number exceeds the default threshold of 3 attempts', async () => {
    const mockShipment = {
      id: 'shipment-123',
      tenant_id: 'tenant-123',
      status: 'out_for_delivery',
      update: jest.fn().mockResolvedValue(true),
    };

    const mockEvent = {
      id: 'event-125',
      status: 'undelivered',
      remark: 'door closed',
      shipment: mockShipment,
    };

    const mockNdr = {
      id: 'ndr-1',
      attempt_number: 3,
      status: 'open',
      shipment: mockShipment,
      update: jest.fn().mockResolvedValue(true),
    };

    TrackingEvent.findByPk.mockResolvedValue(mockEvent);
    NdrEvent.findOne.mockResolvedValue(mockNdr);
    RtoRecord.create.mockResolvedValue({ id: 'rto-1' });

    await ndrDetectionService.detectAndProcessNdrOrRto('event-125');

    expect(mockNdr.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt_number: 4,
        status: 'resolved_rto',
      }),
      expect.any(Object)
    );
    expect(RtoRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment_id: 'shipment-123',
        initiated_by: 'auto_ndr_threshold',
      }),
      expect.any(Object)
    );
    expect(mockShipment.update).toHaveBeenCalledWith({ status: 'cancelled' }, expect.any(Object));
  });
});
