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
  const mockTrackingEventCreate = jest.fn();
  const mockShipmentFindByPk = jest.fn();
  const mockShipmentFindOne = jest.fn();
  const mockShipmentFindAll = jest.fn();
  const mockShipmentUpdate = jest.fn();

  const mockTransactionObj = {
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
  };

  return {
    sequelize: {
      transaction: jest.fn(async () => mockTransactionObj),
    },
    TrackingEvent: {
      create: mockTrackingEventCreate,
    },
    Shipment: {
      findByPk: mockShipmentFindByPk,
      findOne: mockShipmentFindOne,
      findAll: mockShipmentFindAll,
      update: mockShipmentUpdate,
    },
    Order: {
      findByPk: jest.fn().mockResolvedValue({ status: 'processing', update: jest.fn().mockResolvedValue(true) }),
    },
    Tenant: {},
    CourierProvider: {},
    ShipmentStatusHistory: {
      create: jest.fn().mockResolvedValue(true),
    },
  };
});

const trackingService = require('../../src/services/tracking.service');
const { TrackingEvent, Shipment } = require('../../src/models');
const shipmentStatusService = require('../../src/services/shipmentStatus.service');

jest.mock('../../src/services/shipmentStatus.service', () => ({
  validateTransition: jest.fn(),
  logHistory: jest.fn().mockResolvedValue(true),
}));

describe('TrackingService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ingestTrackingEvents', () => {
    it('should ingest new tracking events and update shipment status if changed', async () => {
      const mockShipment = {
        id: 'shipment-123',
        status: 'in_transit',
        update: jest.fn().mockResolvedValue(true),
      };

      Shipment.findByPk.mockResolvedValue(mockShipment);
      TrackingEvent.create.mockResolvedValue({ id: 'event-1' });

      const events = [
        {
          status: 'out_for_delivery',
          raw_status: 'Out for Delivery',
          location: 'Mumbai Hub',
          remark: 'Dispatched from hub',
          event_timestamp: new Date().toISOString(),
        },
      ];

      await trackingService.ingestTrackingEvents('shipment-123', events, 'webhook');

      expect(TrackingEvent.create).toHaveBeenCalled();
      expect(Shipment.findByPk).toHaveBeenCalledWith('shipment-123', expect.any(Object));
      expect(shipmentStatusService.validateTransition).toHaveBeenCalledWith('in_transit', 'out_for_delivery');
      expect(mockShipment.update).toHaveBeenCalledWith({ status: 'out_for_delivery' }, expect.any(Object));
      expect(shipmentStatusService.logHistory).toHaveBeenCalled();
    });

    it('should ignore duplicate events', async () => {
      TrackingEvent.create.mockRejectedValue({ name: 'SequelizeUniqueConstraintError' });

      const events = [
        {
          status: 'in_transit',
          raw_status: 'In Transit',
          event_timestamp: new Date().toISOString(),
        },
      ];

      await expect(
        trackingService.ingestTrackingEvents('shipment-123', events, 'webhook')
      ).resolves.not.toThrow();
    });
  });

  describe('getTrackingTimeline', () => {
    it('should retrieve timeline and events for a valid shipment and tenant', async () => {
      const mockShipmentData = {
        id: 'shipment-123',
        status: 'in_transit',
        is_delayed_flag: false,
        awb_number: 'AWB12345',
        trackingEvents: [
          {
            id: 'ev-1',
            status: 'in_transit',
            raw_status: 'In Transit',
            location: 'Delhi',
            remark: 'Sorted',
            event_timestamp: new Date().toISOString(),
            source: 'webhook',
          },
        ],
      };

      Shipment.findOne.mockResolvedValue(mockShipmentData);

      const res = await trackingService.getTrackingTimeline('shipment-123', 'tenant-456');

      expect(Shipment.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shipment-123', tenant_id: 'tenant-456' },
        })
      );
      expect(res).not.toBeNull();
      expect(res.awb_number).toBe('AWB12345');
      expect(res.events).toHaveLength(1);
    });
  });

  describe('flagStuckShipments', () => {
    it('should flag shipments with no tracking updates in 72 hours as delayed', async () => {
      const mockStuckShipments = [
        { id: 'shipment-stuck-1', trackingEvents: [] },
        { id: 'shipment-stuck-2', trackingEvents: [] },
      ];

      Shipment.findAll.mockResolvedValue(mockStuckShipments);
      Shipment.update.mockResolvedValue([2]);

      const count = await trackingService.flagStuckShipments();

      expect(Shipment.findAll).toHaveBeenCalled();
      expect(Shipment.update).toHaveBeenCalledWith(
        { is_delayed_flag: true },
        expect.objectContaining({
          where: { id: { [Op.in]: ['shipment-stuck-1', 'shipment-stuck-2'] } },
        })
      );
      expect(count).toBe(2);
    });
  });
});
