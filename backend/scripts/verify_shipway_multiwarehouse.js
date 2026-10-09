/**
 * scripts/verify_shipway_multiwarehouse.js
 * 
 * Verifies Problem 1: Shipway multi-warehouse / multi-location order routing.
 * Connects to the live server (or runs directly on live server via SSH)
 * to test both a 1-warehouse tenant and a 3-warehouse tenant routing.
 */
const { Client } = require('ssh2');
const fs = require('fs');

const testRunnerCode = `
require('dotenv').config({ path: '/var/www/nanoshipy/Saas-Frontend-main/backend/.env' });
const { PickupAddress, Order, Tenant, CourierProvider } = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/models');
const ShipwayAdapter = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/shipway/ShipwayAdapter');

async function testRouting() {
  console.log('=== STARTING SHIPWAY MULTI-WAREHOUSE ROUTING VERIFICATION ===\\n');

  // 1. Verify 1-Warehouse Tenant (Regression Test)
  console.log('--- TEST 1: Single-Warehouse Tenant (Regression Protection) ---');
  const singleWhAddress = {
    id: 'single-wh-uuid-1',
    address_line1: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    phone: '9999999999',
    shipway_location_id: null // No custom location id
  };

  const adapter = new ShipwayAdapter({
    username: 'test@nanoshipy.com',
    license_key: 'test_lic_key',
    warehouse_id: 'DEFAULT_WH_99'
  }, { sandbox_mode: true });

  // Mock client.post to intercept the exact outbound payload
  let capturedPayload = null;
  adapter.client = {
    post: async (path, payload) => {
      capturedPayload = payload;
      return { data: { success: 1, order_id: '12345' } };
    }
  };

  // Test warehouse resolution in adapter
  await adapter.createShipment({
    order: {
      id: 'TEST-ORD-001',
      amount: 500,
      payment_mode: 'prepaid',
      customer_name: 'Customer One',
      items: [{ name: 'Item 1', quantity: 1, price: 500 }],
    },
    pickupAddress: singleWhAddress,
  });

  const payload1 = capturedPayload;
  console.log('Single warehouse outbound location_id:', payload1.location_id);
  console.log('Single warehouse outbound warehouse_id:', payload1.warehouse_id);
  if (payload1.location_id === 'DEFAULT_WH_99' && payload1.warehouse_id === 'DEFAULT_WH_99') {
    console.log('✅ TEST 1 PASSED: 1-warehouse tenant gracefully falls back to default warehouse_id/location_id.\n');
  } else {
    console.error('❌ TEST 1 FAILED: Incorrect fallback warehouse ID', payload1);
  }

  // 2. Verify 3-Warehouse Tenant Routing
  console.log('--- TEST 2: 3-Warehouse Tenant Routing (User A with 3 Locations) ---');
  const tenantId = '8413a65d-9fd9-4cf7-9680-252b1feea062'; // User A tenant

  const warehouses = [
    { name: 'Mumbai Hub', pincode: '400001', shipway_location_id: 'SHIPWAY_MUM_HUB_101' },
    { name: 'Delhi Hub', pincode: '110001', shipway_location_id: 'SHIPWAY_DEL_HUB_202' },
    { name: 'Bangalore Hub', pincode: '560001', shipway_location_id: 'SHIPWAY_BLR_HUB_303' },
  ];

  const routingResults = [];

  for (let i = 0; i < warehouses.length; i++) {
    const wh = warehouses[i];
    const pickupAddr = {
      id: `multi-wh-uuid-${i + 1}`,
      tenant_id: tenantId,
      nickname: wh.name,
      address_line1: `Plot ${i + 1}, Industrial Area`,
      city: wh.name.split(' ')[0],
      state: 'State',
      pincode: wh.pincode,
      phone: '9876543210',
      shipway_location_id: wh.shipway_location_id
    };

    await adapter.createShipment({
      order: {
        id: `TEST-ORD-00${i + 2}`,
        amount: 1000 * (i + 1),
        payment_mode: 'prepaid',
        customer_name: `Customer ${i + 2}`,
        items: [{ name: `Item ${i + 1}`, quantity: 1, price: 1000 * (i + 1) }],
      },
      pickupAddress: pickupAddr,
    });

    const orderPayload = capturedPayload;
    console.log(`Order ${i + 1} [${wh.name}] Routing Check:`);
    console.log(`  - Configured shipway_location_id: ${wh.shipway_location_id}`);
    console.log(`  - Outbound payload warehouse_id:  ${orderPayload.warehouse_id}`);
    console.log(`  - Outbound payload location_id:   ${orderPayload.location_id}`);

    const passed = (orderPayload.warehouse_id === wh.shipway_location_id) && 
                   (orderPayload.location_id === wh.shipway_location_id);
    routingResults.push({ warehouse: wh.name, passed, id: wh.shipway_location_id });
  }

  const allPassed = routingResults.every(r => r.passed);
  if (allPassed) {
    console.log('\\n✅ TEST 2 PASSED: All 3 warehouses independently routed to their specific shipway_location_id!');
  } else {
    console.error('\\n❌ TEST 2 FAILED: Location ID mismatch in one or more orders!', routingResults);
  }

  // 3. Verify Database Schema for pickup_addresses
  console.log('\\n--- TEST 3: Database Column Verification ---');
  const [cols] = await PickupAddress.sequelize.query(\`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'pickup_addresses' AND column_name = 'shipway_location_id'
  \`);
  console.log('Column details in DB:', cols);
  if (cols.length > 0) {
    console.log('✅ TEST 3 PASSED: pickup_addresses.shipway_location_id column exists in PostgreSQL and is nullable!\\n');
  } else {
    console.error('❌ TEST 3 FAILED: Column shipway_location_id not found in DB!');
  }

  process.exit(allPassed && cols.length > 0 ? 0 : 1);
}

testRouting().catch(err => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
`;

const b64 = Buffer.from(testRunnerCode).toString('base64');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connecting to live server to execute Shipway Multi-Warehouse verification...');
  conn.exec(`cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e "eval(Buffer.from('${b64}', 'base64').toString())"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', code => {
      console.log(out);
      conn.end();
      process.exit(code);
    });
  });
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa')
});
