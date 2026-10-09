'use strict';

const eventBus = require('../../src/events/eventBus');
const orderService = require('../../src/services/order.service');
const walletService = require('../../src/services/wallet.service');
const { detectAndProcessNdrOrRto } = require('../../src/services/ndrDetection.service');
const { Shipment, NdrEvent } = require('../../src/models');

jest.mock('../../src/models', () => {
  return {
    Shipment: {
      findByPk: jest.fn(),
      update: jest.fn(),
    },
    NdrEvent: {
      create: jest.fn(),
      findOne: jest.fn(),
    },
    User: {
      count: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn(async (cb) => {
        const mockTx = { commit: jest.fn(), rollback: jest.fn() };
        return cb(mockTx);
      }),
    },
  };
});

describe('EventBus Retrofit Verifications - Unit Regression Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    eventBus.removeAllListeners();
  });

  test('should successfully publish order.created event when order is created', (done) => {
    const mockOrder = { id: 'ord-123', order_reference: 'REF-001', tenant_id: 'tenant-1' };
    
    eventBus.on('order.created', (payload) => {
      expect(payload.id).toBe('ord-123');
      expect(payload.order_reference).toBe('REF-001');
      done();
    });

    orderService.onOrderCreated(mockOrder);
  });

  test('should successfully publish order.status_changed event on order state transition', (done) => {
    const mockOrder = { id: 'ord-123', order_reference: 'REF-001', tenant_id: 'tenant-1' };

    eventBus.on('order.status_changed', (payload) => {
      expect(payload.order_reference).toBe('REF-001');
      expect(payload.status).toBe('shipped');
      expect(payload.oldStatus).toBe('ready_to_ship');
      done();
    });

    orderService.onOrderStatusChanged(mockOrder, 'ready_to_ship', 'shipped');
  });

  test('should successfully publish wallet.low_balance event when balance drops below threshold', (done) => {
    eventBus.on('wallet.low_balance', (payload) => {
      expect(payload.tenant_id).toBe('tenant-abc');
      expect(payload.balance).toBe(100);
      expect(payload.threshold).toBe(500);
      done();
    });

    walletService.onLowBalance('tenant-abc', 100, 500);
  });

});
