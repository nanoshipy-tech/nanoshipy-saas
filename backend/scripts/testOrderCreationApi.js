'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testOrderCreationApi() {
  try {
    const tenantId = 'e2e-tenant-1234-5678-901234567890';
    const userId = 'e2e-user-1234-5678-901234567890';

    // Generate JWT token for testing
    const secret = process.env.JWT_ACCESS_SECRET || 'saas_access_secret_key_super_secure_32_chars_long';
    const token = jwt.sign({ user_id: userId, tenant_id: tenantId, role: 'admin' }, secret, { expiresIn: '1h' });

    const { PickupAddress } = require('../src/models');

    // Fetch pickup address directly from DB
    let addr = await PickupAddress.findOne({ where: { tenant_id: tenantId } });
    if (!addr) {
      addr = await PickupAddress.create({
        tenant_id: tenantId,
        label: 'Default Warehouse',
        contact_name: 'Store Manager',
        contact_phone: '9876543210',
        phone: '9876543210',
        address_line1: 'CP Block A',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        is_default: true,
        created_by: userId,
      });
    }

    const pickupAddressId = addr.id;

    // Create Order payload
    const orderPayload = {
      order_reference: 'ORD-LIVE-' + Date.now().toString().slice(-6),
      pickup_address_id: pickupAddressId,
      customer_name: 'Rahul Sharma',
      customer_phone: '9876543210',
      customer_email: 'rahul@example.com',
      shipping_address_line1: 'Flat 402, Green Park',
      shipping_city: 'Delhi',
      shipping_state: 'Delhi',
      shipping_pincode: '110001',
      shipping_country: 'India',
      payment_mode: 'prepaid',
      weight_kg: 0.8,
      length_cm: 15,
      width_cm: 10,
      height_cm: 5,
      items: [
        { product_name: 'Wireless Mouse', sku: 'WM-101', quantity: 1, unit_price: 750.00 }
      ]
    };

    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    console.log(`Sending order creation request to ${apiUrl}/api/v1/orders...`);
    const res = await axios.post(`${apiUrl}/api/v1/orders`, orderPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('\n✅ ORDER CREATION SUCCESSFUL!');
    console.log(JSON.stringify(res.data, null, 2));

  } catch (err) {
    console.error('\n❌ ORDER CREATION FAILED:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
  }
}

testOrderCreationApi();
