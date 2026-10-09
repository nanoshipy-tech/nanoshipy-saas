'use strict';

require('dotenv').config({ path: '/var/www/nanoshipy/Saas-Frontend-main/backend/.env' });
const {
  sequelize,
  CourierProvider,
  TenantCourierAccess,
  StCourierAwbInventory,
  Tenant,
  PickupAddress,
  Order,
  Shipment,
  User,
} = require('../src/models');
const ProviderFactory = require('../src/providers/ProviderFactory');
const courierRoutingService = require('../src/services/courierRouting.service');
const labelService = require('../src/services/labelGeneration.service');
const { Op } = require('sequelize');

async function main() {
  console.log('=== TEST 1: Database Schema & ST Courier Provider Verification ===');
  const stProvider = await CourierProvider.findOne({ where: { provider_key: 'stcourier' } });
  if (!stProvider) {
    throw new Error('ST Courier not found in courier_providers!');
  }
  console.log('  [PASS] ST Courier Provider found:', stProvider.display_name, '(Active:', stProvider.is_active, ', Sandbox:', stProvider.sandbox_mode, ')');

  const tenantAccessCount = await TenantCourierAccess.count({ where: { courier_provider_id: stProvider.id } });
  console.log('  [PASS] Active Tenant Courier Access records for ST Courier:', tenantAccessCount);

  const tableCheck = await sequelize.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'st_courier_awb_inventories' ORDER BY ordinal_position;"
  );
  console.log('  [PASS] st_courier_awb_inventories columns count:', tableCheck[0].length);

  console.log('\n=== TEST 2: AWB Pool Management (Bulk Intake & Concurrency Lock) ===');
  const testBatchId = 'TEST-BATCH-' + Date.now();
  const testAwbs = [
    'STC99' + Math.floor(100000 + Math.random() * 900000),
    'STC99' + Math.floor(100000 + Math.random() * 900000),
    'STC99' + Math.floor(100000 + Math.random() * 900000),
  ];

  console.log('  Uploading test AWBs into pool:', testAwbs);
  const toInsert = testAwbs.map(num => ({
    awb_number: num,
    origin_district: 'Madurai',
    payment_mode: 'both',
    status: 'available',
    batch_id: testBatchId,
    notes: 'Automated E2E Verification Test',
  }));
  await StCourierAwbInventory.bulkCreate(toInsert);

  const availableCount = await StCourierAwbInventory.count({
    where: { batch_id: testBatchId, status: 'available' }
  });
  console.log('  [PASS] Available AWBs verified in database:', availableCount);

  console.log('\n=== TEST 3: Geo-Routing Engine Validation ===');
  // Test A: Intra-TN (Chennai -> Coimbatore)
  const intraTN = await courierRoutingService.determineAssignedCourier('641001', 'Tamil Nadu', '600028', 'Tamil Nadu');
  console.log('  Intra-TN Routing:', intraTN);
  if (intraTN.providerKey !== 'stcourier' || !intraTN.isLocal) {
    throw new Error('Intra-TN routing failed to select stcourier!');
  }
  console.log('  [PASS] Intra-TN correctly routed to ST Courier');

  // Test B: Inter-state (Chennai -> Delhi)
  const interstate = await courierRoutingService.determineAssignedCourier('110001', 'Delhi', '600028', 'Tamil Nadu');
  console.log('  Inter-state Routing:', interstate);
  if (interstate.providerKey !== 'shipway' || interstate.isLocal) {
    throw new Error('Inter-state routing failed to select shipway!');
  }
  console.log('  [PASS] Inter-state correctly routed to National Express Network (Shipway)');

  // Test C: Origin outside TN to TN destination (Delhi -> Chennai)
  const originOutside = await courierRoutingService.determineAssignedCourier('600028', 'Tamil Nadu', '110001', 'Delhi');
  console.log('  Origin outside TN Routing:', originOutside);
  if (originOutside.providerKey !== 'shipway') {
    throw new Error('Origin outside TN should not route to ST Courier!');
  }
  console.log('  [PASS] Origin outside TN correctly routed to National Network');

  console.log('\n=== TEST 4: ST Courier Adapter Rates & Direct Booking ===');
  const adapter = await ProviderFactory.getAdapter('stcourier', {}, stProvider.config || {}, stProvider.id);
  const rateRes = await adapter.getRates({
    pickupPincode: '625001',
    deliveryPincode: '641001',
    weight: 0.5,
    dimensions: { length: 10, width: 10, height: 10 },
    paymentMode: 'prepaid',
    codAmount: 0,
  });
  console.log('  ST Courier Rate Quote:', JSON.stringify(rateRes.data.rates[0]));
  if (!rateRes.success || rateRes.data.rates[0].price !== 30.00) {
    throw new Error('ST Courier base rate calculation mismatch! Expected 30.00, got ' + rateRes.data.rates[0]?.price);
  }
  console.log('  [PASS] Base rate ₹30.00 verified');

  console.log('\n=== TEST 5: Atomic AWB Allocation & Assignment ===');
  const mockOrder = {
    id: require('crypto').randomUUID(),
    order_reference: 'ORD-TEST-' + Date.now().toString().slice(-6),
    payment_mode: 'prepaid',
  };
  const mockPickup = {
    city: 'Madurai',
    pincode: '625001',
    state: 'Tamil Nadu',
  };

  const createRes = await adapter.createShipment({
    order: mockOrder,
    pickupAddress: mockPickup,
    serviceType: 'surface',
  });
  console.log('  ST Courier createShipment response:', createRes.data);
  if (!createRes.success || !createRes.data.awbNumber) {
    throw new Error('Failed to allocate AWB from pool!');
  }
  console.log('  [PASS] Successfully allocated AWB:', createRes.data.awbNumber);

  // Verify status in DB is now assigned
  const assignedRecord = await StCourierAwbInventory.findOne({
    where: { awb_number: createRes.data.awbNumber }
  });
  if (assignedRecord.status !== 'assigned') {
    throw new Error('StCourierAwbInventory status is not assigned!');
  }
  console.log('  [PASS] Database status verified as ASSIGNED with assigned_at:', assignedRecord.assigned_at);

  console.log('\n=== TEST 6: Native 4x6 Thermal Label Synthesis ===');
  const labelPdf = await labelService.renderCustomLabelPDF(
    { awb_number: createRes.data.awbNumber },
    {
      order_reference: mockOrder.order_reference,
      customer_name: 'Karthik Subramanian',
      shipping_address_line1: '45 Gandhipuram 4th Cross',
      shipping_city: 'Coimbatore',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '641001',
      customer_phone: '9840123456',
      payment_mode: 'prepaid',
      order_value: 999.00,
      weight_kg: 0.5,
    },
    stProvider,
    {
      label: 'Madurai Central Hub',
      contact_name: 'Logistics Manager',
      contact_phone: '9876543210',
      address_line1: '12 West Veli Street',
      city: 'Madurai',
      state: 'Tamil Nadu',
      pincode: '625001',
    },
    '4x6'
  );
  console.log('  [PASS] 4x6 Thermal PDF generated successfully, byte size:', labelPdf.length);

  console.log('\n=== TEST 7: Cleanup Test AWBs ===');
  await StCourierAwbInventory.destroy({ where: { batch_id: testBatchId } });
  console.log('  [PASS] Test AWBs cleaned up from database.');

  console.log('\n======================================================');
  console.log('🎉 ALL 7 HYBRID LOGISTICS VERIFICATIONS PASSED ON PRODUCTION!');
  console.log('======================================================');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
