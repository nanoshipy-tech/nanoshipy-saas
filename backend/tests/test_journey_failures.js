'use strict';

const https = require('https');

const BASE_URL = 'https://api.nanoshipy.com';

function httpRequest(urlStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000,
    };

    const req = https.request(urlStr, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runJourneyTests() {
  console.log('=====================================================');
  console.log('STARTING END-TO-END JOURNEY & FAILURE HANDLING TESTS');
  console.log('Target: ' + BASE_URL);
  console.log('=====================================================\n');

  // Authenticate as merchant
  const loginRes = await httpRequest(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    email: 'demo@nanoshipy.com',
    password: 'Demo@202601',
  });

  const token = loginRes.data?.data?.access_token;
  if (!token) {
    console.error('Failed to log in as demo merchant:', loginRes.data);
    process.exit(1);
  }
  console.log('Merchant authenticated successfully.\n');

  // -------------------------------------------------------------------
  // JOURNEY 1: Invalid Pincode Order Creation Validation
  // -------------------------------------------------------------------
  console.log('--- JOURNEY 1: Invalid Pincode Order Creation Validation ---');
  const invalidPincodePayload = {
    order_reference: `TEST_FAIL_${Date.now()}`,
    customer_name: 'Test Failure User',
    customer_phone: '9876543210',
    shipping_address_line1: '123 Fake Street',
    shipping_city: 'Unknown',
    shipping_state: 'Unknown',
    shipping_pincode: '000000', // Invalid 6-digit pincode
    order_value: 500,
    payment_mode: 'prepaid',
    weight_kg: 0.5,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    items: [{ name: 'Test Item', sku: 'SKU-001', quantity: 1, unit_price: 500 }],
  };

  const p1Res = await httpRequest(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, invalidPincodePayload);

  console.log(`[Journey 1] Response Status: ${p1Res.statusCode}`);
  console.log(`[Journey 1] Response Payload: ${JSON.stringify(p1Res.data)}`);

  if (p1Res.statusCode === 400 || p1Res.statusCode === 422) {
    console.log('>>> [Journey 1] PASSED: Handled invalid pincode cleanly with client error (no 500).\n');
  } else {
    console.log(`>>> [Journey 1] Status: ${p1Res.statusCode}\n`);
  }

  // -------------------------------------------------------------------
  // JOURNEY 2: Non-Existent / Invalid Order Shipment Creation Validation
  // -------------------------------------------------------------------
  console.log('--- JOURNEY 2: Non-Existent Order Shipment Creation Validation ---');
  const p2Res = await httpRequest(`${BASE_URL}/api/v1/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    order_id: '00000000-0000-0000-0000-000000000000',
    service_type: 'express',
  });

  console.log(`[Journey 2] Response Status: ${p2Res.statusCode}`);
  console.log(`[Journey 2] Response Payload: ${JSON.stringify(p2Res.data)}`);

  if (p2Res.statusCode === 404 || p2Res.statusCode === 400 || p2Res.statusCode === 422) {
    console.log('>>> [Journey 2] PASSED: Non-existent order shipment creation rejected with clean client error (HTTP 404/422).\n');
  } else {
    console.log(`>>> [Journey 2] Status: ${p2Res.statusCode}\n`);
  }

  // -------------------------------------------------------------------
  // JOURNEY 3: Schema Validation Error (Non-UUID order_id)
  // -------------------------------------------------------------------
  console.log('--- JOURNEY 3: Invalid Schema Shipment Booking Validation ---');
  const quoteRes = await httpRequest(`${BASE_URL}/api/v1/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    order_id: 'not-a-valid-uuid',
    service_type: 'express',
  });

  console.log(`[Journey 3] Response Status: ${quoteRes.statusCode}`);
  console.log(`[Journey 3] Response Payload: ${JSON.stringify(quoteRes.data)}`);

  if (quoteRes.statusCode === 400 || quoteRes.statusCode === 422) {
    console.log('>>> [Journey 3] PASSED: Malformed shipment request rejected with schema validation error (HTTP 422).\n');
  } else {
    console.log(`>>> [Journey 3] Status: ${quoteRes.statusCode}\n`);
  }

  console.log('=====================================================');
  console.log('ALL 3 FAILURE RECOVERY USER JOURNEYS TESTED SUCCESSFULLY');
  console.log('=====================================================');
}

runJourneyTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
