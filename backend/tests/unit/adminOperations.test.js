'use strict';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const {
  Tenant,
  Shipment,
  Order,
  NdrEvent,
  NdrAction,
  RtoRecord,
  PlatformAdmin,
  PlatformAuditLog,
  sequelize,
} = require('../../src/models');
const ndrEventRepository = require('../../src/repositories/ndrEvent.repository');
const rtoRecordRepository = require('../../src/repositories/rtoRecord.repository');
const orderRepository = require('../../src/repositories/order.repository');
const shipmentRepository = require('../../src/repositories/shipment.repository');
const ndrService = require('../../src/services/ndr.service');

describe('Phase 6: Admin Operations Date Filters & NDR/RTO Actions', () => {
  let testAdmin;
  let testTenant;
  let recentOrder;
  let oldOrder;
  let recentShipment;
  let oldShipment;
  let openNdr;
  let terminalNdr;
  let deliveredRto;
  let inTransitRto;

  beforeAll(async () => {
    // 1. Create Admin
    testAdmin = await PlatformAdmin.create({
      id: uuidv4(),
      name: 'Ops Manager',
      email: `ops_${Date.now()}@nanoshipy.com`,
      password_hash: 'hash123',
      role: 'super_admin',
      status: 'active',
      two_factor_enabled: false,
    });

    // 2. Create Tenant
    testTenant = await Tenant.create({
      id: uuidv4(),
      company_name: `Ops Test Merchant ${Date.now()}`,
      subdomain: `ops-${Date.now()}`,
      status: 'active',
      state: 'Maharashtra',
    });

    // 2b. Create Pickup Address
    const { PickupAddress } = require('../../src/models');
    const testPickup = await PickupAddress.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      label: 'Main Warehouse',
      contact_name: 'Ops Manager',
      contact_phone: '9876543210',
      address_line1: '123 Warehouse Rd',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    });

    // 3. Create Orders (one recent, one 45 days old)
    recentOrder = await Order.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_reference: `ORD-REC-${Date.now()}`,
      status: 'pending',
      customer_name: 'Recent Customer',
      customer_phone: '9876543210',
      shipping_pincode: '400001',
      shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_address_line1: '123 Marine Drive',
      order_value: 1200,
      payment_mode: 'prepaid',
      weight_kg: 1.0,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      pickup_address_id: testPickup.id,
    });

    oldOrder = await Order.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_reference: `ORD-OLD-${Date.now()}`,
      status: 'pending',
      customer_name: 'Old Customer',
      customer_phone: '9876543211',
      shipping_pincode: '400001',
      shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_address_line1: '456 Nariman Point',
      order_value: 1500,
      payment_mode: 'prepaid',
      weight_kg: 1.0,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      pickup_address_id: testPickup.id,
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    });

    // 2c. Create User & CourierProvider
    const { User, Role, CourierProvider } = require('../../src/models');
    const testRole = await Role.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      name: 'Owner',
      is_system_role: true,
    });
    const testUser = await User.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      role_id: testRole.id,
      name: 'Ops User',
      email: `user_${Date.now()}@ops.com`,
      password_hash: 'hash123',
    });
    const testProvider = await CourierProvider.create({
      id: uuidv4(),
      provider_key: `mock_${Date.now()}`,
      display_name: 'Mock Express Provider',
      credentials_encrypted: 'dummy_enc',
      is_active: true,
      service_types: ['surface', 'express'],
    });

    // 4. Create Shipments (one recent, one 45 days old)
    recentShipment = await Shipment.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_id: recentOrder.id,
      courier_provider_id: testProvider.id,
      pickup_address_id: testPickup.id,
      awb_number: `AWB-REC-${Date.now()}`,
      service_type: 'surface',
      status: 'out_for_delivery',
      declared_weight_kg: 1.0,
      charged_weight_kg: 1.0,
      selected_rate: 100.0,
      created_by: testUser.id,
    });

    oldShipment = await Shipment.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      order_id: oldOrder.id,
      courier_provider_id: testProvider.id,
      pickup_address_id: testPickup.id,
      awb_number: `AWB-OLD-${Date.now()}`,
      service_type: 'surface',
      status: 'delivered',
      declared_weight_kg: 1.0,
      charged_weight_kg: 1.0,
      selected_rate: 100.0,
      created_by: testUser.id,
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    });

    // 5. Create NDR Events (open vs terminal)
    openNdr = await NdrEvent.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      shipment_id: recentShipment.id,
      reason_code: 'CUSTOMER_UNAVAILABLE',
      raw_reason: 'Customer not home at 2 PM',
      attempt_number: 1,
      status: 'open',
      sla_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    terminalNdr = await NdrEvent.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      shipment_id: oldShipment.id,
      reason_code: 'CUSTOMER_REFUSED',
      raw_reason: 'Customer refused parcel',
      attempt_number: 3,
      status: 'resolved_rto',
      sla_due_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    });

    // 6. Create RTO records (delivered vs in_transit)
    deliveredRto = await RtoRecord.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      shipment_id: oldShipment.id,
      initiated_reason: 'Max delivery attempts exceeded',
      initiated_by: 'system',
      status: 'rto_delivered',
    });

    inTransitRto = await RtoRecord.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      shipment_id: recentShipment.id,
      initiated_reason: 'Customer refused delivery',
      initiated_by: 'manual',
      status: 'rto_in_transit',
    });
  });

  afterAll(async () => {
    await NdrAction.destroy({ where: { ndr_event_id: [openNdr.id, terminalNdr.id] } }).catch(() => {});
    await RtoRecord.destroy({ where: { id: [deliveredRto.id, inTransitRto.id] } }).catch(() => {});
    await NdrEvent.destroy({ where: { id: [openNdr.id, terminalNdr.id] } }).catch(() => {});
    await Shipment.destroy({ where: { id: [recentShipment.id, oldShipment.id] } }).catch(() => {});
    await Order.destroy({ where: { id: [recentOrder.id, oldOrder.id] } }).catch(() => {});
    await PlatformAuditLog.destroy({ where: { platform_admin_id: testAdmin.id } }).catch(() => {});
    await PlatformAdmin.destroy({ where: { id: testAdmin.id } }).catch(() => {});
    await Tenant.destroy({ where: { id: testTenant.id } }).catch(() => {});
  });

  test('Order & Shipment repositories default to 30 days and respect custom from/to date ranges', async () => {
    // 1. Orders default to last 30 days
    const defaultOrders = await orderRepository.findAndCountAll(testTenant.id, {});
    const orderItems = defaultOrders.items || defaultOrders.rows || [];
    const orderIds = orderItems.map(o => o.id);
    assert.ok(orderIds.includes(recentOrder.id), 'Recent order must be present in default 30-day window');
    assert.strictEqual(orderIds.includes(oldOrder.id), false, '45-day old order must NOT be in default 30-day window');

    // 2. Orders with all_time include old orders
    const allOrders = await orderRepository.findAndCountAll(testTenant.id, { all_time: true });
    const allOrderItems = allOrders.items || allOrders.rows || [];
    const allOrderIds = allOrderItems.map(o => o.id);
    assert.ok(allOrderIds.includes(oldOrder.id), 'All-time query must include old order');

    // 3. Shipments default to last 30 days
    const defaultShipments = await shipmentRepository.findAll({ tenant_id: testTenant.id });
    const shipmentIds = defaultShipments.rows.map(s => s.id);
    assert.ok(shipmentIds.includes(recentShipment.id), 'Recent shipment must be in default 30-day window');
    assert.strictEqual(shipmentIds.includes(oldShipment.id), false, '45-day old shipment must NOT be in default 30-day window');
  });

  test('RTO Record repository filters by tab: delivered vs in_transit', async () => {
    // 1. Delivered Tab
    const deliveredResult = await rtoRecordRepository.findAll({
      tenant_id: testTenant.id,
      tab: 'delivered',
      all_time: true,
    });
    const deliveredIds = deliveredResult.rows.map(r => r.id);
    assert.ok(deliveredIds.includes(deliveredRto.id), 'Delivered tab must include delivered RTO');
    assert.strictEqual(deliveredIds.includes(inTransitRto.id), false, 'Delivered tab must NOT include in_transit RTO');

    // 2. In Transit Tab
    const inTransitResult = await rtoRecordRepository.findAll({
      tenant_id: testTenant.id,
      tab: 'in_transit',
      all_time: true,
    });
    const inTransitIds = inTransitResult.rows.map(r => r.id);
    assert.ok(inTransitIds.includes(inTransitRto.id), 'In-transit tab must include in_transit RTO');
    assert.strictEqual(inTransitIds.includes(deliveredRto.id), false, 'In-transit tab must NOT include delivered RTO');
  });

  test('NDR takeAction rejects terminal states with 409 and supports escalate_courier with audit logging', async () => {
    // 1. Reject action on terminal NDR
    let errorCaught = null;
    try {
      await ndrService.takeNdrAction(terminalNdr.id, testTenant.id, testAdmin.id, {
        action_type: 'reattempt',
      });
    } catch (err) {
      errorCaught = err;
    }
    assert.ok(errorCaught, 'Action on terminal NDR must throw error');
    assert.strictEqual(errorCaught.status, 409, 'Error status must be 409');
    assert.strictEqual(errorCaught.code, 'NDR_ALREADY_RESOLVED');

    // 2. Perform escalate_courier action with platform admin audit options
    const actionResult = await ndrService.takeNdrAction(
      openNdr.id,
      testTenant.id,
      testAdmin.id,
      {
        action_type: 'escalate_courier',
        notes: 'Priority courier escalation via ops admin',
      },
      null,
      {
        isPlatformAdmin: true,
        adminId: testAdmin.id,
        ipAddress: '127.0.0.1',
      }
    );

    assert.strictEqual(actionResult.status, 'action_taken');
    assert.strictEqual(actionResult.action_type, 'escalate_courier');

    // 3. Verify NdrAction recorded
    const actionRecord = await NdrAction.findOne({
      where: { ndr_event_id: openNdr.id, action_type: 'escalate_courier' },
    });
    assert.ok(actionRecord, 'NdrAction record for escalate_courier must exist');
    assert.strictEqual(actionRecord.notes, 'Priority courier escalation via ops admin');

    // 4. Verify PlatformAuditLog entry created
    const auditEntry = await PlatformAuditLog.findOne({
      where: {
        platform_admin_id: testAdmin.id,
        action: 'ndr_action_escalate_courier',
        entity_id: openNdr.id,
      },
    });
    assert.ok(auditEntry, 'PlatformAuditLog entry must be recorded for escalate_courier');
    assert.strictEqual(auditEntry.target_tenant_id, testTenant.id);
  });
});
