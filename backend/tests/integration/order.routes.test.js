const request = require('supertest');
const app = require('../../src/app');
const { Tenant, User, Role, PickupAddress, Order, OrderItem, OrderStatusHistory, OrderImport } = require('../../src/models');
const sequelize = require('../../src/config/db.config');

const tenantAId = '85f3da92-c98e-49b4-b4bf-ac087114e41b';
const tenantBId = '85f3da92-c98e-49b4-b4bf-ac087114e41d';
const pickupAddressAId = '85f3da92-c98e-49b4-b4bf-ac087114e41c';
const pickupAddressBId = '85f3da92-c98e-49b4-b4bf-ac087114e41e';

let mockCurrentTenantId = tenantAId;

// Mock auth middleware to dynamically swap tenant scope
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'd1356a2a-22a4-4599-a7ea-ac5168368c56',
      tenant_id: mockCurrentTenantId,
      role: 'owner',
      permissions: ['order.view', 'order.create', 'order.update', 'order.delete', 'order.bulk_upload'],
    };
    req.tenant = { id: mockCurrentTenantId };
    next();
  }
}));

// Mock fileUploadService to prevent calling real S3
jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('http://mockstorage/import-errors-report.csv'),
  deleteFile: jest.fn().mockResolvedValue(true),
}));

// Mock planEnforcement.service to bypass plan limit checks in integration tests
jest.mock('../../src/services/planEnforcement.service', () => ({
  checkLimit: jest.fn().mockResolvedValue(true),
  incrementUsage: jest.fn().mockResolvedValue(true),
}));

describe('Order Management Routes (Integration)', () => {
  const roleAId = 'c03f0dc0-3d61-4502-9524-6e82f8138a65';
  const userAId = 'd1356a2a-22a4-4599-a7ea-ac5168368c56';

  let orderId;

  beforeAll(async () => {
    await sequelize.sync();

    // 0. Clean test orders first
    await OrderStatusHistory.destroy({ where: {}, force: true }).catch(() => {});
    await OrderItem.destroy({ where: {}, force: true }).catch(() => {});
    await Order.destroy({ where: { tenant_id: [tenantAId, tenantBId] }, force: true }).catch(() => {});
    await OrderImport.destroy({ where: { tenant_id: [tenantAId, tenantBId] }, force: true }).catch(() => {});

    // Seed database with A and B tenant data safely via findOrCreate
    await Tenant.findOrCreate({
      where: { id: tenantAId },
      defaults: { id: tenantAId, company_name: 'Tenant A', subdomain: 'tenant-a', status: 'active', kyc_status: 'approved' },
    });
    await Tenant.findOrCreate({
      where: { id: tenantBId },
      defaults: { id: tenantBId, company_name: 'Tenant B', subdomain: 'tenant-b', status: 'active', kyc_status: 'approved' },
    });
    await Tenant.update({ kyc_status: 'approved' }, { where: { id: [tenantAId, tenantBId] } });

    await Role.findOrCreate({
      where: { id: roleAId },
      defaults: { id: roleAId, tenant_id: tenantAId, name: 'owner', is_system_role: false },
    });

    await User.findOrCreate({
      where: { id: userAId },
      defaults: {
        id: userAId,
        tenant_id: tenantAId,
        role_id: roleAId,
        name: 'Owner A',
        email: 'owner-a@test.com',
        password_hash: 'mock',
        status: 'active',
      },
    });

    await PickupAddress.findOrCreate({
      where: { id: pickupAddressAId },
      defaults: {
        id: pickupAddressAId,
        tenant_id: tenantAId,
        label: 'Tenant A Warehouse',
        contact_name: 'Mgr A',
        contact_phone: '+919876543210',
        address_line1: '12 Industrial Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        is_default: true,
      },
    });

    await PickupAddress.findOrCreate({
      where: { id: pickupAddressBId },
      defaults: {
        id: pickupAddressBId,
        tenant_id: tenantBId,
        label: 'Tenant B Warehouse',
        contact_name: 'Mgr B',
        contact_phone: '+919876543212',
        address_line1: '45 Trade Zone',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        is_default: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up only test-created data
    await OrderStatusHistory.destroy({ where: {}, force: true }).catch(() => {});
    await OrderItem.destroy({ where: {}, force: true }).catch(() => {});
    await Order.destroy({ where: { tenant_id: [tenantAId, tenantBId] }, force: true }).catch(() => {});
    await OrderImport.destroy({ where: { tenant_id: [tenantAId, tenantBId] }, force: true }).catch(() => {});
  });

  describe('Single Order CRUD Endpoints', () => {
    it('should create a single order successfully', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_reference: 'ORD-INT-001',
          pickup_address_id: pickupAddressAId,
          customer_name: 'Priya Menon',
          customer_phone: '+919876543211',
          customer_email: 'priya@example.com',
          shipping_address_line1: '45 Anna Nagar',
          shipping_city: 'Chennai',
          shipping_state: 'Tamil Nadu',
          shipping_pincode: '600040',
          payment_mode: 'cod',
          cod_amount: 1499.00,
          weight_kg: 0.5,
          length_cm: 20,
          width_cm: 15,
          height_cm: 10,
          items: [
            { product_name: 'Cotton Kurta', sku: 'KRT-001', quantity: 1, unit_price: 1499.00 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_reference).toBe('ORD-INT-001');
      expect(res.body.data.status).toBe('pending');
      orderId = res.body.data.id;
    });

    it('should reject creating an order with a duplicate order_reference', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          order_reference: 'ORD-INT-001', // duplicate
          pickup_address_id: pickupAddressAId,
          customer_name: 'Bob',
          customer_phone: '+919876543211',
          shipping_address_line1: '123 street',
          shipping_city: 'Chennai',
          shipping_state: 'Tamil Nadu',
          shipping_pincode: '600040',
          payment_mode: 'prepaid',
          weight_kg: 0.5,
          length_cm: 20,
          width_cm: 15,
          height_cm: 10,
          items: [
            { product_name: 'Shirt', sku: 'SH-01', quantity: 1, unit_price: 500.00 }
          ]
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ORDER_REFERENCE');
    });

    it('should retrieve order details with items and status history', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.statusHistory.length).toBe(1);
    });

    it('should allow editing a pending order', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderId}`)
        .send({
          customer_name: 'Priya Menon Edited',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_name).toBe('Priya Menon Edited');
    });

    it('should transition status successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/status`)
        .send({
          status: 'processing',
          note: 'Processing order items'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('processing');

      // Verify log history entry added
      const order = await Order.findByPk(orderId, { include: ['statusHistory'] });
      expect(order.statusHistory.length).toBe(2);
      expect(order.statusHistory[1].new_status).toBe('processing');
    });

    it('should reject invalid status transitions', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderId}/status`)
        .send({
          status: 'pending' // invalid: cannot go back from processing to pending
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should cancel the order successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/orders/${orderId}`)
        .send({
          note: 'Cancelled by owner request'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should block editing a cancelled order', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderId}`)
        .send({
          customer_name: 'Should Fail'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    });
  });

  describe('Bulk Import Endpoints', () => {
    it('should download the CSV template', async () => {
      const res = await request(app)
        .get('/api/v1/orders/template');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('order_reference');
    });

    it('should upload bulk CSV and process mixed validity rows', async () => {
      // Create a CSV string containing 1 valid row and 1 invalid row (missing phone)
      const csvContent = 
        `order_reference,pickup_address_id,customer_name,customer_phone,customer_email,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_pincode,shipping_country,order_value,payment_mode,cod_amount,weight_kg,length_cm,width_cm,height_cm,product_name,sku,quantity,unit_price\n` +
        `ORD-BULK-001,${pickupAddressAId},Alice S.,+919876543220,alice@test.com,12 Park Street,,Kolkata,West Bengal,700016,India,1200.00,prepaid,0.00,1.5,25,20,15,Belt,SKU-B,1,1200.00\n` +
        `ORD-BULK-002,${pickupAddressAId},Bob J.,,bob@test.com,34 Lake Rd,,Kolkata,West Bengal,700029,India,850.00,prepaid,0.00,0.8,15,12,8,Mug,SKU-M,2,425.00\n`;

      const res = await request(app)
        .post('/api/v1/orders/bulk-import')
        .attach('file', Buffer.from(csvContent), 'orders_upload.csv');

      expect(res.statusCode).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.success_count).toBe(1);
      expect(res.body.data.failed_count).toBe(1);
      expect(res.body.data.error_report_url).toBe('http://mockstorage/import-errors-report.csv');
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    let orderAId;

    beforeAll(async () => {
      // Create a Tenant A order
      mockCurrentTenantId = tenantAId;
      const orderA = await Order.create({
        tenant_id: tenantAId,
        order_reference: 'ORD-TENANT-A',
        pickup_address_id: pickupAddressAId,
        customer_name: 'Tenant A Customer',
        customer_phone: '+919876543290',
        shipping_address_line1: 'Addr A',
        shipping_city: 'Mumbai',
        shipping_state: 'Maharashtra',
        shipping_pincode: '400001',
        order_value: 500.00,
        payment_mode: 'prepaid',
        weight_kg: 1.0,
        length_cm: 10,
        width_cm: 10,
        height_cm: 10,
        status: 'pending',
      });
      orderAId = orderA.id;
    });

    it('should block Tenant B from fetching Tenant A\'s order', async () => {
      // Swap mock auth context to Tenant B
      mockCurrentTenantId = tenantBId;

      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should block Tenant B from updating Tenant A\'s order', async () => {
      mockCurrentTenantId = tenantBId;

      const res = await request(app)
        .put(`/api/v1/orders/${orderAId}`)
        .send({ customer_name: 'Hacker' });

      expect(res.statusCode).toBe(404);
    });
  });
});
