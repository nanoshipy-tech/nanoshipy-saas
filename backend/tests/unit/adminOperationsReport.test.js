'use strict';

const assert = require('assert');
const adminOperationsReportService = require('../../src/services/adminOperationsReport.service');
const { generateExport } = require('../../src/utils/adminExport.util');
const {
  Tenant,
  PlatformAdmin,
  CourierProvider,
  PickupAddress,
  Order,
  Shipment,
  User,
  Role,
  sequelize,
} = require('../../src/models');
const { v4: uuidv4 } = require('uuid');

describe('Admin Operations Reports (District-Wise, KAM-Wise, and Master Ledger)', () => {
  let testKam;
  let testTenant;
  let testUser;
  let testCourier;
  let testPickup;
  let testOrder;
  let testShipment;

  beforeAll(async () => {
    // 1. Seed KAM
    testKam = await PlatformAdmin.create({
      id: uuidv4(),
      name: 'Priya Sharma (KAM)',
      email: `kam_ops_${Date.now()}@nanoshipy.com`,
      password_hash: 'hash123',
      role: 'key_account_manager',
      status: 'active',
      two_factor_enabled: false,
    });

    // 2. Seed Tenant
    testTenant = await Tenant.create({
      id: uuidv4(),
      company_name: 'Cureka Healthcare Brands',
      subdomain: `cureka-${Date.now()}`,
      status: 'active',
      state: 'Tamil Nadu',
      kam_id: testKam.id,
      support_email: 'ops@cureka.com',
      support_phone: '9988776655',
    });

    // 3. Seed User
    const existingRole = await Role.findOne();
    const roleId = existingRole ? existingRole.id : uuidv4();

    testUser = await User.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      name: 'Cureka Ops Manager',
      email: `user_ops_${Date.now()}@cureka.com`,
      password_hash: 'hash123',
      role: 'admin',
      role_id: roleId,
    });

    // 4. Seed or find Courier
    testCourier = await CourierProvider.findOne();
    if (!testCourier) {
      testCourier = await CourierProvider.create({
        id: uuidv4(),
        provider_key: `bluedart_${Date.now()}`,
        display_name: 'Blue Dart Express',
        credentials_encrypted: 'dummy_encrypted_creds',
        is_active: true,
      });
    }

    // 5. Seed Pickup Address (Mumbai)
    testPickup = await PickupAddress.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      label: 'Mumbai Central Warehouse',
      contact_name: 'Warehouse Lead',
      contact_phone: '9876543210',
      address_line1: 'Plot 45, MIDC Industrial Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      is_default: true,
    });

    // 6. Seed Order (Delhi destination)
    testOrder = await Order.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_reference: `ORD-CUR-${Date.now()}`,
      pickup_address_id: testPickup.id,
      customer_name: 'Amit Verma',
      customer_phone: '9123456780',
      customer_email: 'amit.verma@example.com',
      shipping_address_line1: 'B-12, Connaught Place',
      shipping_address_line2: 'Near Metro Gate 3',
      shipping_city: 'New Delhi',
      shipping_state: 'Delhi',
      shipping_pincode: '110001',
      order_value: 2450.00,
      payment_mode: 'cod',
      cod_amount: 2450.00,
      weight_kg: 0.850,
      length_cm: 15.0,
      width_cm: 10.0,
      height_cm: 5.0,
      status: 'pending',
      source: 'manual',
    });

    // 7. Seed Shipment
    testShipment = await Shipment.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_id: testOrder.id,
      courier_provider_id: testCourier.id,
      pickup_address_id: testPickup.id,
      awb_number: `AWB${Date.now()}`,
      service_type: 'express',
      selected_rate: 85.50,
      sell_rate: 85.50,
      cod_charge: 40.00,
      declared_weight_kg: 0.850,
      charged_weight_kg: 1.000,
      status: 'delivered',
      created_by: testUser.id,
    });
  });

  afterAll(async () => {
    if (testShipment) await testShipment.destroy().catch(() => {});
    if (testOrder) await testOrder.destroy().catch(() => {});
    if (testPickup) await testPickup.destroy().catch(() => {});
    if (testCourier) await testCourier.destroy().catch(() => {});
    if (testUser) await testUser.destroy().catch(() => {});
    if (testTenant) await testTenant.destroy().catch(() => {});
    if (testKam) await testKam.destroy().catch(() => {});
  });

  it('generates operational report matching all 15 required fields', async () => {
    const report = await adminOperationsReportService.getOperationsReport({
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      kam_id: testKam.id,
    });

    assert(report.summary, 'Summary should be present');
    assert.strictEqual(report.summary.total_shipments, 1);
    assert.strictEqual(report.summary.total_order_value, 2450.00);
    assert.strictEqual(report.summary.total_freight_charge, 85.50);
    assert.strictEqual(report.summary.total_cod_charge, 40.00);
    assert.strictEqual(report.summary.delivered_count, 1);

    assert(report.rows.length === 1, 'Should return exactly 1 shipment row');
    const row = report.rows[0];

    // Verify all 15 requested fields
    assert.strictEqual(row.awb_number, testShipment.awb_number);
    assert.strictEqual(row.order_number, testOrder.order_reference);
    assert.strictEqual(row.courier_name, testCourier.display_name || testCourier.name);
    assert.strictEqual(row.tenant_name, testTenant.company_name);
    assert.strictEqual(row.order_value, 2450.00);
    assert.strictEqual(row.payment_mode, 'COD');
    assert.strictEqual(row.freight_charge, 85.50);
    assert.strictEqual(row.status, 'delivered');
    assert(row.created_date && row.created_date.length > 0);
    assert(row.zone.startsWith('Zone'), `Zone should be resolved (got ${row.zone})`);
    assert.strictEqual(row.cod_charge, 40.00);
    assert.strictEqual(row.return_freight_charge, 0.00);
    assert.strictEqual(row.kam_name, 'Priya Sharma (KAM)');
    assert(row.address.includes('Connaught Place'));
    assert(row.state.includes('Delhi'));
    assert(row.district && row.district.length > 0);
  });

  it('generates correct district-wise breakdown', async () => {
    const report = await adminOperationsReportService.getOperationsReport({
      kam_id: testKam.id,
    });

    assert(report.district_breakdown.length >= 1);
    const dBreakdown = report.district_breakdown[0];
    assert.strictEqual(dBreakdown.total_orders, 1);
    assert.strictEqual(dBreakdown.delivered_orders, 1);
    assert.strictEqual(dBreakdown.delivery_rate_pct, 100);
    assert.strictEqual(dBreakdown.total_order_value, 2450.00);
    assert.strictEqual(dBreakdown.total_freight_charge, 85.50);
  });

  it('generates correct KAM-wise breakdown', async () => {
    const report = await adminOperationsReportService.getOperationsReport({
      kam_id: testKam.id,
    });

    assert(report.kam_breakdown.length === 1);
    const kBreakdown = report.kam_breakdown[0];
    assert.strictEqual(kBreakdown.kam_name, 'Priya Sharma (KAM)');
    assert.strictEqual(kBreakdown.assigned_sellers_count, 1);
    assert.strictEqual(kBreakdown.total_orders, 1);
    assert.strictEqual(kBreakdown.total_order_value, 2450.00);
    assert.strictEqual(kBreakdown.total_freight_charge, 85.50);
    assert.strictEqual(kBreakdown.total_cod_charge, 40.00);
  });

  it('exports operational report to valid CSV and XLSX buffers', async () => {
    const exportResult = await adminOperationsReportService.exportOperationsReport({
      kam_id: testKam.id,
    });

    assert(exportResult.columns.length >= 15);
    assert.strictEqual(exportResult.data.length, 1);

    // Test CSV generation
    const csvExport = generateExport({
      data: exportResult.data,
      columns: exportResult.columns,
      format: 'csv',
    });
    assert.strictEqual(csvExport.extension, 'csv');
    assert(csvExport.buffer.length > 0);
    const csvContent = csvExport.buffer.toString('utf-8');
    assert(csvContent.includes('AWB Number'));
    assert(csvContent.includes(testShipment.awb_number));
    assert(csvContent.includes('Priya Sharma (KAM)'));

    // Test XLSX generation
    const xlsxExport = generateExport({
      data: exportResult.data,
      columns: exportResult.columns,
      format: 'xlsx',
    });
    assert.strictEqual(xlsxExport.extension, 'xlsx');
    assert(xlsxExport.buffer.length > 0);
  });
});
