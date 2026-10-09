'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { Tenant, User, Role, PickupAddress, Order, CourierProvider, TenantCourierAccess, Shipment, ShipmentRateQuote, ShipmentStatusHistory, OrderStatusHistory, Wallet } = require('../../src/models');
const sequelize = require('../../src/config/db.config');
const providerCredentialService = require('../../src/services/providerCredential.service');

// Mock auth middleware to inject mock user with required permissions
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'd1356a2a-22a4-4599-a7ea-ac5168368c55',
      tenant_id: '85f3da92-c98e-49b4-b4bf-ac087114e41a',
      role: 'owner',
      permissions: ['shipment.create', 'shipment.view', 'shipment.cancel', 'shipment.label_generate'],
    };
    req.tenant = { id: '85f3da92-c98e-49b4-b4bf-ac087114e41a' };
    next();
  }
}));

// Mock fileUploadService to prevent calling real AWS/Cloudflare endpoints
jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('http://mockstorage/label.pdf'),
  deleteFile: jest.fn().mockResolvedValue(true),
}));

// Mock providerHealth.service to bypass health check queries during testing
jest.mock('../../src/services/providerHealth.service', () => ({
  isHealthy: jest.fn().mockResolvedValue(true),
}));

// Mock planEnforcement.service to bypass subscription/plan limit checks in integration tests
jest.mock('../../src/services/planEnforcement.service', () => ({
  checkLimit: jest.fn().mockResolvedValue(true),
  incrementUsage: jest.fn().mockResolvedValue(true),
}));

jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    ...actualAxios,
    get: jest.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/pdf' },
      data: Buffer.from('%PDF-1.4 mock pdf label buffer data'),
    }),
    post: jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true },
    }),
  };
});

jest.setTimeout(25000);

const { Op } = require('sequelize');

describe('Shipment & Rate Comparison Routes (Integration)', () => {
  const tenantId = '85f3da92-c98e-49b4-b4bf-ac087114e41a';
  const roleId = 'c03f0dc0-3d61-4502-9524-6e82f8138a64';
  const userId = 'd1356a2a-22a4-4599-a7ea-ac5168368c55';
  
  let courierProviderId = '8fa08c02-e25f-4a0b-9d41-dc08a8e3f940';
  const pickupAddressId = '12356a2a-22a4-4599-a7ea-ac5168368c55';
  const orderId = 'a1236a2a-22a4-4599-a7ea-ac5168368111';

  let testQuoteId;
  let testShipmentId;
  let quotedServiceType = 'surface';
  let quotedPrice = 50.00;

  beforeAll(async () => {
    // 0. Clean prior shipments/orders
    await sequelize.query(`DELETE FROM shipment_status_histories WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM cost_rate_snapshots WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM shipments WHERE tenant_id = '${tenantId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM shipment_rate_quotes WHERE tenant_id = '${tenantId}' OR order_id = '${orderId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM order_status_histories WHERE order_id = '${orderId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE id = '${orderId}'`).catch(() => {});

    // 1. Seed Tenant, Role, User
    await Tenant.findOrCreate({
      where: { id: tenantId },
      defaults: {
        id: tenantId,
        company_name: 'Test Shipment Company',
        subdomain: 'test-shipment',
        status: 'active',
        kyc_status: 'approved',
      },
    });
    await Tenant.update({ kyc_status: 'approved' }, { where: { id: tenantId } });

    await Role.findOrCreate({
      where: { id: roleId },
      defaults: {
        id: roleId,
        tenant_id: tenantId,
        name: 'owner',
        is_system_role: false,
      },
    });

    await User.findOrCreate({
      where: { id: userId },
      defaults: {
        id: userId,
        tenant_id: tenantId,
        role_id: roleId,
        name: 'Test Owner User',
        email: 'shipment-owner@test.com',
        password_hash: 'mock-hash',
        status: 'active',
        email_verified_at: new Date(),
      },
    });

    // 2. Seed CourierProvider (Mock Provider)
    const encryptedCreds = providerCredentialService.encrypt({ apiKey: 'mock-key' });
    const [provider] = await CourierProvider.findOrCreate({
      where: { provider_key: 'mock' },
      defaults: {
        id: courierProviderId,
        provider_key: 'mock',
        display_name: 'Mock Courier Integration',
        is_active: true,
        priority: 1,
        service_types: ['surface', 'express'],
        credentials_encrypted: encryptedCreds,
        config: {},
      },
    });
    courierProviderId = provider.id;

    // 3. Enable Tenant Courier Access
    await TenantCourierAccess.findOrCreate({
      where: { tenant_id: tenantId, courier_provider_id: provider.id },
      defaults: {
        tenant_id: tenantId,
        courier_provider_id: provider.id,
        is_enabled: true,
      },
    });

    // 4. Seed PickupAddress
    await PickupAddress.findOrCreate({
      where: { id: pickupAddressId },
      defaults: {
        id: pickupAddressId,
        tenant_id: tenantId,
        label: 'Main Warehouse',
        contact_name: 'Store Manager',
        contact_phone: '9876543210',
        address_line1: '123 Warehouse St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        is_default: true,
      },
    });

    // 5. Seed Order (ready_to_ship)
    const [order] = await Order.findOrCreate({
      where: { id: orderId },
      defaults: {
        id: orderId,
        tenant_id: tenantId,
        order_reference: 'ORD-INT-777',
        pickup_address_id: pickupAddressId,
        customer_name: 'John Doe',
        customer_phone: '9999999999',
        shipping_address_line1: '456 Customer Ave',
        shipping_city: 'Delhi',
        shipping_state: 'Delhi',
        shipping_pincode: '110001',
        shipping_country: 'India',
        order_value: 120.00,
        payment_mode: 'prepaid',
        weight_kg: 1.25,
        length_cm: 15.00,
        width_cm: 10.00,
        height_cm: 5.00,
        status: 'ready_to_ship',
        created_by: userId,
      },
    });
    await order.update({ status: 'ready_to_ship' });

    // 6. Seed Wallet for Balance Checks
    await Wallet.findOrCreate({
      where: { tenant_id: tenantId },
      defaults: {
        tenant_id: tenantId,
        balance: 5000.00,
        low_balance_threshold: 500.00,
      },
    });
  });

  afterAll(async () => {
    // Clean up database records
    await sequelize.query(`DELETE FROM shipment_status_histories WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM cost_rate_snapshots WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM shipments WHERE tenant_id = '${tenantId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM shipment_rate_quotes WHERE tenant_id = '${tenantId}' OR order_id = '${orderId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM order_status_histories WHERE order_id = '${orderId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE id = '${orderId}'`).catch(() => {});
  });

  describe('Rate Comparison & Quote Saving', () => {
    it('should successfully compare rates and record quotes in the database', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/rates`)
        .send();


      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(orderId);
      expect(Array.isArray(res.body.data.rates)).toBe(true);
      expect(res.body.data.rates.length).toBeGreaterThan(0);
      
      const firstRate = res.body.data.rates[0];
      expect(firstRate.courier_provider_id).toBe(courierProviderId);
      expect(firstRate.price).toBeDefined();
      quotedServiceType = firstRate.service_type || 'surface';
      quotedPrice = parseFloat(firstRate.price);

      // Retrieve saved quote from DB
      const dbQuote = await ShipmentRateQuote.findOne({
        where: { order_id: orderId, courier_provider_id: courierProviderId },
      });
      expect(dbQuote).toBeDefined();
      expect(parseFloat(dbQuote.price)).toBe(firstRate.price);
    });
  });

  describe('Shipment Creation (Booking)', () => {
    it('should fail booking if price tampering is detected', async () => {
      const res = await request(app)
        .post('/api/v1/shipments')
        .send({
          order_id: orderId,
          courier_provider_id: courierProviderId,
          service_type: quotedServiceType,
          quoted_rate: quotedPrice + 500.00, // Tampered rate
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_QUOTE_EXPIRED');
    });

    it('should successfully book a shipment using a valid quote', async () => {
      await sequelize.query(`DELETE FROM shipment_status_histories WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
      await sequelize.query(`DELETE FROM cost_rate_snapshots WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
      await sequelize.query(`DELETE FROM shipments WHERE tenant_id = '${tenantId}'`).catch(() => {});
      await Order.update({ status: 'ready_to_ship' }, { where: { id: orderId } });

      const res = await request(app)
        .post('/api/v1/shipments')
        .send({
          order_id: orderId,
          courier_provider_id: courierProviderId,
          service_type: quotedServiceType,
          quoted_rate: quotedPrice,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.awb_number).toBeDefined();
      expect(res.body.data.status).toBe('awb_generated');
      expect(res.body.data.label_url).toBeDefined();

      testShipmentId = res.body.data.id;

      // Verify linked order status transitioned to 'shipped'
      const updatedOrder = await Order.findByPk(orderId);
      expect(updatedOrder.status).toBe('shipped');
    });
  });

  describe('Shipment Queries', () => {
    it('should list shipments for tenant', async () => {
      const res = await request(app)
        .get('/api/v1/shipments')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBe(1);
      expect(res.body.data.rows[0].id).toBe(testShipmentId);
    });

    it('should return shipment detail with status history log', async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/${testShipmentId}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testShipmentId);
      expect(res.body.data.order.order_reference).toBe('ORD-INT-777');
      expect(Array.isArray(res.body.data.statusHistory)).toBe(true);
      expect(res.body.data.statusHistory.length).toBeGreaterThan(0);
    });

    it('should return shipment summary counts for dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/shipments/summary')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.awb_generated).toBe(1);
    });
  });

  describe('Shipment Cancellation', () => {
    it('should cancel shipment pre-pickup and revert order back to ready_to_ship', async () => {
      const res = await request(app)
        .put(`/api/v1/shipments/${testShipmentId}/cancel`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify shipment status updated to cancelled
      const updatedShipment = await Shipment.findByPk(testShipmentId);
      expect(updatedShipment.status).toBe('cancelled');

      // Verify linked order status reverted back to ready_to_ship
      const updatedOrder = await Order.findByPk(orderId);
      expect(updatedOrder.status).toBe('ready_to_ship');
    });

    it('should block cancellation if shipment status moves past pickup_scheduled', async () => {
      // Manually set status to picked_up to test transition check
      await Shipment.update({ status: 'picked_up' }, { where: { id: testShipmentId } });

      const res = await request(app)
        .put(`/api/v1/shipments/${testShipmentId}/cancel`)
        .send();

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SHIPMENT_NOT_CANCELLABLE');
    });
  });
});
