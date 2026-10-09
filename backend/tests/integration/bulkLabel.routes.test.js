'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { Tenant, User, Role, PickupAddress, Order, CourierProvider, TenantCourierAccess, Shipment } = require('../../src/models');
const sequelize = require('../../src/config/db.config');
const providerCredentialService = require('../../src/services/providerCredential.service');

// Mock auth middleware to inject mock user with required permissions
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'd2356a2a-22a4-4599-a7ea-ac5168368c56',
      tenant_id: 'b8f3da92-c98e-49b4-b4bf-ac087114e41b',
      role: 'owner',
      permissions: ['shipment.create', 'shipment.view', 'shipment.cancel', 'shipment.label_generate'],
    };
    req.tenant = { id: 'b8f3da92-c98e-49b4-b4bf-ac087114e41b' };
    next();
  }
}));

// Mock fileUploadService to prevent calling real AWS/Cloudflare endpoints
jest.fn();
jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('http://mockstorage/label.pdf'),
  deleteFile: jest.fn().mockResolvedValue(true),
}));

// Mock providerHealth.service to bypass health check queries during testing
jest.mock('../../src/services/providerHealth.service', () => ({
  recordCall: jest.fn().mockResolvedValue(true),
}));

// Mock axios to intercept label downloads
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    ...actualAxios,
    get: jest.fn().mockImplementation((url, config) => {
      if (url.includes('shipway') || url.includes('delhivery') || url.includes('mock') || url.includes('label')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
          data: Buffer.from('%PDF-1.4 mock pdf label buffer data'),
        };
      }
      return actualAxios.get(url, config);
    }),
  };
});

describe('Shipment Label Endpoints (Integration)', () => {
  const tenantId = 'b8f3da92-c98e-49b4-b4bf-ac087114e41b';
  const roleId = 'c13f0dc0-3d61-4502-9524-6e82f8138a65';
  const userId = 'd2356a2a-22a4-4599-a7ea-ac5168368c56';
  
  const courierProviderId = '8fa08c02-e25f-4a0b-9d41-dc08a8e3f940';
  const pickupAddressId = '13356a2a-22a4-4599-a7ea-ac5168368c56';
  
  let order1Id = 'b1236a2a-22a4-4599-a7ea-ac5168368111';
  let order2Id = 'b2346a2a-22a4-4599-a7ea-ac5168368222';
  
  let shipment1Id;
  let shipment2Id;

  beforeAll(async () => {
    // 0. Clean up any previous test shipments/orders
    await sequelize.query(`DELETE FROM shipment_status_histories WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM shipments WHERE tenant_id = '${tenantId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE tenant_id = '${tenantId}'`).catch(() => {});

    // 1. Seed Tenant, Role, User
    await Tenant.findOrCreate({
      where: { id: tenantId },
      defaults: {
        id: tenantId,
        company_name: 'Test Bulk Label Company',
        subdomain: 'test-bulk-label',
        status: 'active',
      },
    });

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
        name: 'Test Label User',
        email: 'label-test-owner@test.com',
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
        label: 'Warehouse Primary',
        contact_name: 'Store Keeper',
        contact_phone: '+919999999999',
        address_line1: '123 Test Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India',
      },
    });

    // 5. Seed Orders
    const [o1] = await Order.findOrCreate({
      where: { id: order1Id },
      defaults: {
        id: order1Id,
        tenant_id: tenantId,
        order_reference: 'ORD-BULK-1',
        pickup_address_id: pickupAddressId,
        customer_name: 'Alice',
        customer_email: 'alice@test.com',
        customer_phone: '+919999999981',
        shipping_address_line1: 'Apt 1',
        shipping_city: 'Mumbai',
        shipping_state: 'Maharashtra',
        shipping_pincode: '400001',
        shipping_country: 'India',
        order_value: 150.00,
        payment_mode: 'prepaid',
        weight_kg: 1.25,
        length_cm: 15.00,
        width_cm: 10.00,
        height_cm: 5.00,
        status: 'ready_to_ship',
      },
    });

    const [o2] = await Order.findOrCreate({
      where: { id: order2Id },
      defaults: {
        id: order2Id,
        tenant_id: tenantId,
        order_reference: 'ORD-BULK-2',
        pickup_address_id: pickupAddressId,
        customer_name: 'Bob',
        customer_email: 'bob@test.com',
        customer_phone: '+919999999982',
        shipping_address_line1: 'Apt 2',
        shipping_city: 'Mumbai',
        shipping_state: 'Maharashtra',
        shipping_pincode: '400001',
        shipping_country: 'India',
        order_value: 250.00,
        payment_mode: 'prepaid',
        weight_kg: 1.25,
        length_cm: 15.00,
        width_cm: 10.00,
        height_cm: 5.00,
        status: 'ready_to_ship',
      },
    });

    // 6. Seed Shipments
    const s1 = await Shipment.create({
      tenant_id: tenantId,
      order_id: order1Id,
      courier_provider_id: provider.id,
      pickup_address_id: pickupAddressId,
      status: 'awb_generated',
      awb_number: 'AWB-BULK-1',
      service_type: 'express',
      quoted_rate: 50.00,
      selected_rate: 50.00,
      declared_weight_kg: 1.25,
      created_by: userId,
    });
    shipment1Id = s1.id;

    const s2 = await Shipment.create({
      tenant_id: tenantId,
      order_id: order2Id,
      courier_provider_id: provider.id,
      pickup_address_id: pickupAddressId,
      status: 'awb_generated',
      awb_number: 'AWB-BULK-2',
      service_type: 'express',
      quoted_rate: 60.00,
      selected_rate: 60.00,
      declared_weight_kg: 1.25,
      created_by: userId,
    });
    shipment2Id = s2.id;
  });

  afterAll(async () => {
    await sequelize.query(`DELETE FROM shipment_status_histories WHERE shipment_id IN (SELECT id FROM shipments WHERE tenant_id = '${tenantId}')`).catch(() => {});
    await sequelize.query(`DELETE FROM shipments WHERE tenant_id = '${tenantId}'`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE tenant_id = '${tenantId}'`).catch(() => {});
  });

  describe('Single Label Generation', () => {
    it('should successfully generate and upload a single label PDF', async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/${shipment1Id}/label`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.label_url).toBe('http://mockstorage/label.pdf');
    });
  });

  describe('Bulk Label Merging', () => {
    it('should fail bulk merging with empty shipment IDs array', async () => {
      const res = await request(app)
        .post('/api/v1/shipments/bulk-label')
        .send({ shipment_ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('non-empty array');
    });

    it('should fail bulk merging when shipment IDs exceeds 100', async () => {
      const longArray = Array.from({ length: 101 }, (_, i) => `shipment-${i}`);
      const res = await request(app)
        .post('/api/v1/shipments/bulk-label')
        .send({ shipment_ids: longArray });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('more than 100 labels');
    });

    it('should successfully merge labels for multiple shipments', async () => {
      const res = await request(app)
        .post('/api/v1/shipments/bulk-label')
        .send({ shipment_ids: [shipment1Id, shipment2Id] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.label_url).toBe('http://mockstorage/label.pdf');
    });
  });
});
