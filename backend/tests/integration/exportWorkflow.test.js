'use strict';

const fs = require('fs');
const path = require('path');
const {
  Tenant,
  User,
  PickupAddress,
  Order,
  ExportJob,
  WebhookEndpoint,
  WebhookDelivery,
} = require('../../src/models');
const exportJobService = require('../../src/services/exportJob.service');
const exportProcessorService = require('../../src/services/exportProcessor.service');

describe('Admin Export Workflow & Webhook Delivery Integration Test', () => {
  let testTenant;
  let testUser;
  let testEndpoint;
  let testPickup;

  beforeAll(async () => {
    // Ensure test tenant exists
    testTenant = await Tenant.create({
      id: 'd9b7367c-9b78-43bf-9226-c22cb9a6e111',
      name: 'Integration Test Tenant',
      company_name: 'Test Tenant Ltd',
      subdomain: `test-export-${Date.now()}`,
      status: 'active',
      plan_type: 'enterprise',
    }).catch(async () => {
      return await Tenant.findByPk('d9b7367c-9b78-43bf-9226-c22cb9a6e111');
    });

    const { Role } = require('../../src/models');
    let testRole = await Role.findOne({ where: { name: 'owner' } });
    if (!testRole) {
      testRole = await Role.create({
        id: 'r-int-' + Date.now(),
        tenant_id: testTenant.id,
        name: 'owner',
        is_system_role: false,
      }).catch(async () => await Role.findOne());
    }

    testUser = await User.create({
      id: 'a8b7367c-9b78-43bf-9226-c22cb9a6e222',
      tenant_id: testTenant.id,
      role_id: testRole ? testRole.id : 'c03f0dc0-3d61-4502-9524-6e82f8138a65',
      name: 'Export Tester',
      email: `export-tester-${Date.now()}@nanoshipy.com`,
      password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      status: 'active',
    }).catch(async () => {
      return await User.findByPk('a8b7367c-9b78-43bf-9226-c22cb9a6e222');
    });

    testPickup = await PickupAddress.create({
      id: 'pa-int-' + Date.now(),
      tenant_id: testTenant.id,
      label: 'Main Warehouse',
      contact_name: 'Warehouse Manager',
      contact_phone: '+919876543210',
      address_line1: '12 Logistics Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    });

    // Create seed orders for this tenant to export
    await Order.create({
      id: 'o1-' + Date.now(),
      tenant_id: testTenant.id,
      order_reference: 'ORD-INT-001',
      pickup_address_id: testPickup.id,
      status: 'shipped',
      payment_mode: 'prepaid',
      order_value: 1499.5,
      weight_kg: 0.5,
      length_cm: 15,
      width_cm: 10,
      height_cm: 5,
      customer_name: 'John Doe',
      customer_phone: '9876543210',
      shipping_address_line1: '123 Marine Drive',
      shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_pincode: '400001',
    });

    await Order.create({
      id: 'o2-' + Date.now(),
      tenant_id: testTenant.id,
      order_reference: 'ORD-INT-002',
      pickup_address_id: testPickup.id,
      status: 'delivered',
      payment_mode: 'cod',
      order_value: 850.0,
      weight_kg: 0.8,
      length_cm: 20,
      width_cm: 12,
      height_cm: 8,
      customer_name: 'Jane Smith',
      customer_phone: '9876543211',
      shipping_address_line1: '45 MG Road',
      shipping_city: 'Bengaluru',
      shipping_state: 'Karnataka',
      shipping_pincode: '560001',
    });

    // Create an active webhook endpoint for this tenant
    await WebhookEndpoint.destroy({ where: { tenant_id: testTenant.id } }).catch(() => {});
    testEndpoint = await WebhookEndpoint.create({
      id: 'e8b7367c-9b78-43bf-9226-c22cb9a6e333',
      tenant_id: testTenant.id,
      url: 'https://webhook.site/test-integration-export',
      secret: 'whsec_test_integration_secret_key_abcdef',
      events: ['export.completed', 'export.failed'],
      is_active: true,
      description: 'Integration Test Webhook Receiver',
    });
  });

  afterAll(async () => {
    // Cleanup generated export test files
    if (testTenant) {
      const tenantUploadDir = path.join(process.cwd(), 'uploads', 'tenants', testTenant.id, 'exports');
      if (fs.existsSync(tenantUploadDir)) {
        try {
          fs.rmSync(tenantUploadDir, { recursive: true, force: true });
        } catch {}
      }
    }
  });

  test('should create and process an export job end-to-end', async () => {
    // 1. Request Export Job
    const jobResult = await exportJobService.requestExport({
      tenantId: testTenant.id,
      userId: testUser ? testUser.id : null,
      entity: 'orders',
      filters: { status: 'shipped' },
      columns: ['order_reference', 'status', 'payment_mode', 'total_amount', 'customer_name'],
      forceAsync: true,
    });

    expect(jobResult).toBeDefined();
    const jobId = jobResult.job_id || jobResult.id;
    expect(jobId).toBeDefined();

    // 2. Await background completion or process directly
    let processedJob = await ExportJob.findByPk(jobId);
    let waitAttempts = 0;
    while (processedJob.status !== 'completed' && processedJob.status !== 'failed' && waitAttempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      processedJob = await ExportJob.findByPk(jobId);
      waitAttempts++;
    }

    if (processedJob.status === 'queued') {
      processedJob = await exportProcessorService.processJob(jobId);
    }

    expect(processedJob).toBeDefined();
    expect(processedJob.status).toBe('completed');
    expect(processedJob.total_rows).toBeGreaterThanOrEqual(1);
    expect(processedJob.file_key).toBeDefined();
    expect(processedJob.file_size).toBeGreaterThan(0);
    expect(processedJob.expires_at).toBeDefined();

    // Verify file actually exists on disk
    const resolvedPath = path.resolve(process.cwd(), 'uploads', processedJob.file_key);
    expect(fs.existsSync(resolvedPath)).toBe(true);
    const stats = fs.statSync(resolvedPath);
    expect(stats.size).toBe(processedJob.file_size);

    // 3. Verify webhook delivery was recorded
    const deliveries = await WebhookDelivery.findAll({
      where: {
        tenant_id: testTenant.id,
        event: 'export.completed',
      },
    });

    expect(deliveries.length).toBeGreaterThanOrEqual(1);
    const latestDelivery = deliveries[deliveries.length - 1];
    expect(latestDelivery.payload).toBeDefined();
    expect(latestDelivery.payload.event).toBe('export.completed');
    expect(latestDelivery.payload.data.export_id).toBe(jobId);
    expect(latestDelivery.payload.data.entity).toBe('orders');
    expect(latestDelivery.payload.data.total_rows).toBe(processedJob.total_rows);
  });

  test('should enforce tenant isolation in list and download', async () => {
    // Create a job for testTenant
    const job = await ExportJob.create({
      id: 'job-isolation-test-' + Date.now(),
      tenant_id: testTenant.id,
      requested_by: testUser ? testUser.id : null,
      entity: 'orders',
      status: 'completed',
      file_key: 'dummy-file-key.xlsx',
      file_size: 1024,
      expires_at: new Date(Date.now() + 86400000),
    });

    // Querying with the correct tenant returns the job
    const found = await exportJobService.getJob(job.id, testTenant.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(job.id);

    // Querying with another tenant throws or rejects
    await expect(exportJobService.getJob(job.id, 'foreign-tenant-uuid')).rejects.toThrow();
  });
});

