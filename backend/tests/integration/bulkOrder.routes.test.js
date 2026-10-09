'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { Tenant, User, Role, PickupAddress, Order, OrderItem } = require('../../src/models');
const sequelize = require('../../src/config/db.config');

// Mock auth middleware
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'f1111111-22a4-4599-a7ea-ac5168368c56',
      tenant_id: 'c1111111-c98e-49b4-b4bf-ac087114e41b',
      role: 'owner',
      permissions: ['order.view', 'order.create', 'order.update'],
    };
    req.tenant = {
      id: 'c1111111-c98e-49b4-b4bf-ac087114e41b',
      company_name: 'Bulk Orders Test Store',
      support_email: 'care@teststore.com',
      support_phone: '9876543210',
    };
    next();
  },
}));

// Mock fileUploadService
jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('/uploads/orders/bulk_invoices/mock_merged_orders.pdf'),
  deleteFile: jest.fn().mockResolvedValue(true),
}));

describe('Bulk Order PDF Generation Endpoint (Integration)', () => {
  const tenantId = 'c1111111-c98e-49b4-b4bf-ac087114e41b';
  const roleId = 'c2222222-3d61-4502-9524-6e82f8138a65';
  const userId = 'f1111111-22a4-4599-a7ea-ac5168368c56';
  const pickupAddressId = 'a1111111-22a4-4599-a7ea-ac5168368c56';

  let order1Id = 'e1111111-22a4-4599-a7ea-ac5168368111';
  let order2Id = 'e2222222-22a4-4599-a7ea-ac5168368222';

  beforeAll(async () => {
    await sequelize.query(`DELETE FROM order_items WHERE order_id IN ('${order1Id}', '${order2Id}')`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE tenant_id = '${tenantId}'`).catch(() => {});

    await Tenant.findOrCreate({
      where: { id: tenantId },
      defaults: {
        id: tenantId,
        company_name: 'Bulk Orders Test Store',
        subdomain: 'test-bulk-orders',
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
        name: 'Test Bulk Order User',
        email: 'bulkorderuser@test.com',
        password_hash: 'mock-hash',
        status: 'active',
        email_verified_at: new Date(),
      },
    });

    await PickupAddress.findOrCreate({
      where: { id: pickupAddressId },
      defaults: {
        id: pickupAddressId,
        tenant_id: tenantId,
        label: 'Primary Warehouse',
        contact_name: 'Warehouse Manager',
        contact_phone: '9876543210',
        address_line1: '123 Test Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        is_default: true,
      },
    });

    await Order.create({
      id: order1Id,
      tenant_id: tenantId,
      created_by: userId,
      pickup_address_id: pickupAddressId,
      order_reference: 'TEST-ORD-001',
      customer_name: 'John Doe',
      customer_phone: '9876543210',
      customer_email: 'john@example.com',
      shipping_address_line1: '456 Delivery St',
      shipping_city: 'Delhi',
      shipping_state: 'Delhi',
      shipping_pincode: '110001',
      shipping_country: 'India',
      payment_mode: 'prepaid',
      order_value: 499.00,
      weight_kg: 0.5,
      length_cm: 10.0,
      width_cm: 10.0,
      height_cm: 5.0,
      status: 'pending',
    });

    await OrderItem.create({
      id: 'd1111111-22a4-4599-a7ea-ac5168368111',
      order_id: order1Id,
      product_name: 'Wireless Bluetooth Earbuds',
      quantity: 1,
      unit_price: 499.00,
    });

    await Order.create({
      id: order2Id,
      tenant_id: tenantId,
      created_by: userId,
      pickup_address_id: pickupAddressId,
      order_reference: 'TEST-ORD-002',
      customer_name: 'Jane Smith',
      customer_phone: '9876543211',
      customer_email: 'jane@example.com',
      shipping_address_line1: '789 Central Ave',
      shipping_city: 'Bengaluru',
      shipping_state: 'Karnataka',
      shipping_pincode: '560001',
      shipping_country: 'India',
      payment_mode: 'cod',
      order_value: 899.00,
      cod_amount: 899.00,
      weight_kg: 0.8,
      length_cm: 12.0,
      width_cm: 10.0,
      height_cm: 6.0,
      status: 'processing',
    });

    await OrderItem.create({
      id: 'd2222222-22a4-4599-a7ea-ac5168368222',
      order_id: order2Id,
      product_name: 'Fast Charging Adapter 65W',
      quantity: 1,
      unit_price: 899.00,
    });
  });

  afterAll(async () => {
    await sequelize.query(`DELETE FROM order_items WHERE order_id IN ('${order1Id}', '${order2Id}')`).catch(() => {});
    await sequelize.query(`DELETE FROM orders WHERE tenant_id = '${tenantId}'`).catch(() => {});
  });

  it('should fail bulk order PDF generation with empty order IDs array', async () => {
    const res = await request(app)
      .post('/api/v1/orders/bulk-pdf')
      .send({ order_ids: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('non-empty array');
  });

  it('should fail bulk order PDF generation when order IDs exceeds 100', async () => {
    const longArray = Array.from({ length: 101 }, (_, i) => `order-${i}`);
    const res = await request(app)
      .post('/api/v1/orders/bulk-pdf')
      .send({ order_ids: longArray });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('more than 100');
  });

  it('should successfully generate and merge invoice PDFs for multiple orders', async () => {
    const res = await request(app)
      .post('/api/v1/orders/bulk-pdf')
      .send({ order_ids: [order1Id, order2Id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pdf_url).toBe('/uploads/orders/bulk_invoices/mock_merged_orders.pdf');
    expect(res.body.data.count).toBe(2);
  });
});
