'use strict';

// Mock the database configuration file before requiring anything
jest.mock('../../src/config/db.config', () => {
  return {
    transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

// Mock the models manually to prevent auto-requiring that triggers DB connection define calls
jest.mock('../../src/models', () => {
  const mockOrderFindOne = jest.fn();
  const mockQuoteFindOne = jest.fn();
  const mockProviderFindByPk = jest.fn();
  const mockShipmentCreate = jest.fn();
  const mockShipmentFindOne = jest.fn();
  const mockShipmentFindAll = jest.fn();

  const mockProviderScope = jest.fn(() => ({
    findByPk: mockProviderFindByPk,
  }));

  const mockWallet = {
    balance: '1000.00',
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
  };

  return {
    Order: {
      findOne: mockOrderFindOne,
    },
    ShipmentRateQuote: {
      findOne: mockQuoteFindOne,
      create: jest.fn().mockImplementation((data) => ({ id: 'mock-quote-id', ...data })),
      bulkCreate: jest.fn().mockResolvedValue(true),
    },
    CourierProvider: {
      scope: mockProviderScope,
    },
    Shipment: {
      create: mockShipmentCreate,
      findOne: mockShipmentFindOne,
      findAll: mockShipmentFindAll,
    },
    Wallet: {
      findOne: jest.fn().mockResolvedValue(mockWallet),
      create: jest.fn().mockResolvedValue({}),
    },
    WalletTransaction: {
      create: jest.fn().mockResolvedValue({}),
    },
    TenantSubscription: {
      findOne: jest.fn().mockResolvedValue({
        plan: {
          courier_access_tier: 'all',
          max_orders_per_month: 1000,
        },
      }),
    },
    SubscriptionPlan: {
      findOne: jest.fn().mockResolvedValue({}),
    },
    PlanUsageTracking: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ orders_count: 0 }),
    },
    SellerPaymentProfile: {
      findOne: jest.fn().mockResolvedValue({
        tenant_id: 'mock-tenant-id',
        payment_mode: 'prepaid',
        credit_limit: 0.00,
        outstanding_amount: 0.00,
        reserved_credit: 0.00,
        availableCredit: 0.00,
        billing_cycle: 'weekly',
        payment_terms_days: 7,
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
        update: jest.fn().mockResolvedValue(true),
      }),
      create: jest.fn().mockResolvedValue({}),
    },
    SellerPaymentTermsHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    PostpaidInvoice: {
      create: jest.fn().mockResolvedValue({}),
    },
    PostpaidTransaction: {
      create: jest.fn().mockResolvedValue({}),
    },
    PostpaidPayment: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
});

const shipmentService = require('../../src/services/shipment.service');
const { Order, ShipmentRateQuote, CourierProvider, Shipment, Wallet, SellerPaymentProfile } = require('../../src/models');
const {
  OrderNotShippableError,
  RateQuoteExpiredError,
  ProviderShipmentCreationFailedError,
  ShipmentNotCancellableError,
} = require('../../src/utils/errors');
const shipmentStatusService = require('../../src/services/shipmentStatus.service');
const orderStatusService = require('../../src/services/orderStatus.service');
const ProviderFactory = require('../../src/providers/ProviderFactory');
const fileUploadService = require('../../src/services/fileUpload.service');
const auditService = require('../../src/services/audit.service');

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: Buffer.from('mock pdf') }),
}));
jest.mock('../../src/services/shipmentStatus.service');
jest.mock('../../src/services/orderStatus.service');
jest.mock('../../src/providers/ProviderFactory');
jest.mock('../../src/services/fileUpload.service');
jest.mock('../../src/services/audit.service');
jest.mock('../../src/services/providerCredential.service', () => ({
  decrypt: jest.fn().mockReturnValue({ apiKey: 'test-api-key' }),
  encrypt: jest.fn().mockReturnValue('mock-encrypted-blob'),
}));

describe('ShipmentService - Unit Tests', () => {
  let mockOrder;
  let mockQuote;
  let mockProvider;
  let mockAdapter;
  let mockShipment;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrder = {
      id: 'order-123',
      order_reference: 'REF-123',
      status: 'ready_to_ship',
      weight_kg: '1.50',
      order_value: '500.00',
      payment_mode: 'prepaid',
      cod_amount: null,
      pickup_address_id: 'pickup-123',
      pickupAddress: { pincode: '400001' },
      update: jest.fn().mockResolvedValue(true),
    };

    mockQuote = {
      id: 'quote-123',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10m in future
      price: '50.00',
      cod_charge: '0.00',
    };

    mockProvider = {
      id: 'provider-123',
      provider_key: 'mock_provider',
      display_name: 'Mock Provider',
      is_active: true,
      credentials_encrypted: 'some-encrypted-blob',
      config: {},
    };

    mockAdapter = {
      createShipment: jest.fn().mockResolvedValue({
        success: true,
        data: {
          awbNumber: 'MOCK-AWB-123',
          courierShipmentId: 'COURIER-123',
          labelUrl: 'http://mock.com/label.pdf',
          estimatedPickupDate: '2026-07-12',
        },
        providerRawResponse: { raw: true },
      }),
      cancelShipment: jest.fn().mockResolvedValue({
        success: true,
        data: {},
      }),
    };

    mockShipment = {
      id: 'shipment-123',
      status: 'awb_generated',
      awb_number: 'MOCK-AWB-123',
      order_id: 'order-123',
      courier_provider_id: 'provider-123',
      selected_rate: 50.00,
      update: jest.fn().mockResolvedValue(true),
      order: mockOrder,
    };

    Order.findOne.mockResolvedValue(mockOrder);
    ShipmentRateQuote.findOne.mockResolvedValue(mockQuote);
    
    // Setup model scoped query mock
    const scopeMock = CourierProvider.scope();
    scopeMock.findByPk.mockResolvedValue(mockProvider);

    ProviderFactory.getAdapter.mockReturnValue(mockAdapter);
    Shipment.create.mockResolvedValue(mockShipment);
    Shipment.findOne.mockResolvedValue(null);
    fileUploadService.uploadFile.mockResolvedValue('http://local/label.pdf');

    Wallet.findOne.mockResolvedValue({
      balance: '1000.00',
      save: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true),
    });
    SellerPaymentProfile.findOne.mockResolvedValue({
      tenant_id: 'tenant-123',
      payment_mode: 'prepaid',
      credit_limit: 0.00,
      outstanding_amount: 0.00,
      reserved_credit: 0.00,
      availableCredit: 0.00,
      billing_cycle: 'weekly',
      payment_terms_days: 7,
      status: 'active',
      save: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true),
    });
  });

  describe('createShipment', () => {
    it('should successfully book shipment and update order to shipped', async () => {
      const result = await shipmentService.createShipment({
        order_id: 'order-123',
        courier_provider_id: 'provider-123',
        service_type: 'express',
        quoted_rate: 50.00,
      }, 'tenant-123', 'user-123');

      expect(result).toBe(mockShipment);
      expect(Order.findOne).toHaveBeenCalled();
      expect(ShipmentRateQuote.findOne).toHaveBeenCalled();
      expect(mockAdapter.createShipment).toHaveBeenCalled();
      expect(mockOrder.update).toHaveBeenCalledWith({ status: 'shipped' }, { transaction: expect.any(Object) });
      expect(Shipment.create).toHaveBeenCalled();
      expect(orderStatusService.logHistory).toHaveBeenCalledWith(
        'order-123',
        'ready_to_ship',
        'shipped',
        'user-123',
        expect.any(String),
        expect.any(Object)
      );
      expect(shipmentStatusService.logHistory).toHaveBeenCalledWith(
        expect.any(String),
        null,
        'created',
        'system',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should deduct both freight charge and COD charge from wallet for COD orders', async () => {
      mockOrder.payment_mode = 'cod';
      mockOrder.cod_amount = '1000.00';
      mockQuote.cod_charge = '40.00';
      mockQuote.price = '50.00';

      const SellerPaymentService = require('../../src/services/sellerPayment.service');
      const spyReserve = jest.spyOn(SellerPaymentService, 'reserveShipmentPayment');
      const spyCapture = jest.spyOn(SellerPaymentService, 'captureShipmentPayment');

      const result = await shipmentService.createShipment({
        order_id: 'order-123',
        courier_provider_id: 'provider-123',
        service_type: 'express',
        quoted_rate: 90.00, // 50 freight + 40 cod
      }, 'tenant-123', 'user-123');

      expect(result).toBe(mockShipment);
      expect(Shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          selected_rate: 90.00,
          sell_rate: 50.00,
          cod_charge: 40.00,
        }),
        expect.any(Object)
      );
      expect(spyReserve).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 90.00,
        })
      );
      expect(spyCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 90.00,
        })
      );

      spyReserve.mockRestore();
      spyCapture.mockRestore();
    });

    it('should return existing active shipment on retry without re-booking (Idempotency Guard)', async () => {
      Shipment.findOne.mockResolvedValue(mockShipment);

      const result = await shipmentService.createShipment({
        order_id: 'order-123',
        courier_provider_id: 'provider-123',
        service_type: 'express',
        quoted_rate: 50.00,
      }, 'tenant-123', 'user-123');

      expect(result).toBe(mockShipment);
      expect(mockAdapter.createShipment).not.toHaveBeenCalled();
      expect(Shipment.create).not.toHaveBeenCalled();
    });

    it('should fail if order is not in ready_to_ship status', async () => {
      mockOrder.status = 'delivered';

      await expect(
        shipmentService.createShipment({
          order_id: 'order-123',
          courier_provider_id: 'provider-123',
          service_type: 'express',
          quoted_rate: 50.00,
        }, 'tenant-123', 'user-123')
      ).rejects.toThrow(OrderNotShippableError);

      expect(mockAdapter.createShipment).not.toHaveBeenCalled();
      expect(Shipment.create).not.toHaveBeenCalled();
    });

    it('should fail if rate quote is expired', async () => {
      mockQuote.expires_at = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5m in past

      await expect(
        shipmentService.createShipment({
          order_id: 'order-123',
          courier_provider_id: 'provider-123',
          service_type: 'express',
          quoted_rate: 50.00,
        }, 'tenant-123', 'user-123')
      ).rejects.toThrow(RateQuoteExpiredError);

      expect(mockAdapter.createShipment).not.toHaveBeenCalled();
      expect(Shipment.create).not.toHaveBeenCalled();
    });

    it('should fail if price tampering is detected (no quote matches)', async () => {
      mockQuote.price = '75.00';
      ShipmentRateQuote.findOne.mockResolvedValue(mockQuote);

      await expect(
        shipmentService.createShipment({
          order_id: 'order-123',
          courier_provider_id: 'provider-123',
          service_type: 'express',
          quoted_rate: 50.00, // Quote expects 75.00
        }, 'tenant-123', 'user-123')
      ).rejects.toThrow(RateQuoteExpiredError);

      expect(mockAdapter.createShipment).not.toHaveBeenCalled();
      expect(Shipment.create).not.toHaveBeenCalled();
    });

    it('should propagate adapter errors and block DB writes', async () => {
      mockAdapter.createShipment.mockResolvedValue({
        success: false,
        error: { message: 'Pincode not serviceable' },
      });

      await expect(
        shipmentService.createShipment({
          order_id: 'order-123',
          courier_provider_id: 'provider-123',
          service_type: 'express',
          quoted_rate: 50.00,
        }, 'tenant-123', 'user-123')
      ).rejects.toThrow(ProviderShipmentCreationFailedError);

      expect(Shipment.create).not.toHaveBeenCalled();
      expect(mockOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelShipment', () => {
    it('should successfully cancel pre-pickup shipment and revert order status', async () => {
      mockShipment.awb_number = 'AWB987654321';
      mockProvider.provider_key = 'shipway';
      Shipment.findOne.mockResolvedValue(mockShipment);

      const result = await shipmentService.cancelShipment('shipment-123', 'tenant-123', 'user-123');

      expect(result.success).toBe(true);
      expect(mockShipment.update).toHaveBeenCalledWith({ status: 'cancelled' }, { transaction: expect.any(Object) });
      expect(mockOrder.update).toHaveBeenCalledWith({ status: 'ready_to_ship' }, { transaction: expect.any(Object) });
      expect(mockAdapter.cancelShipment).toHaveBeenCalledWith(
        expect.objectContaining({ awbNumber: 'AWB987654321' })
      );
    });

    it('should fail if shipment is already picked_up', async () => {
      Shipment.findOne.mockResolvedValue(mockShipment);
      mockShipment.status = 'picked_up';

      await expect(
        shipmentService.cancelShipment('shipment-123', 'tenant-123', 'user-123')
      ).rejects.toThrow(ShipmentNotCancellableError);

      expect(mockAdapter.cancelShipment).not.toHaveBeenCalled();
    });
  });
});
