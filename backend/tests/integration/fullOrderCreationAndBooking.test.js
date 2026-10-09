'use strict';

const assert = require('assert');
const orderService = require('../../src/services/order.service');
const pricingService = require('../../src/services/pricing.service');
const shipmentService = require('../../src/services/shipment.service');
const walletService = require('../../src/services/wallet.service');
const { Tenant, User, Role, PickupAddress, CourierProvider, Wallet, Order, Shipment, CostRateSnapshot } = require('../../src/models');

describe('End-to-End Order Creation, Rate Comparison, & Shipment Booking Test', () => {
  jest.setTimeout(45000);

  let tenant, user, pickupAddress, provider;

  beforeAll(async () => {
    // 1. Seed tenant, user, wallet, pickup address, and provider
    const tenantId = 'e2e-tenant-1234-5678-901234567890';
    const userId = 'e2e-user-1234-5678-901234567890';

    let tObj = await Tenant.findByPk(tenantId);
    if (!tObj) {
      tObj = await Tenant.create({
        id: tenantId,
        company_name: 'E2E Test Store',
        subdomain: 'e2estore',
        brand_name: 'E2E Store',
        company_email: 'e2e@store.com',
        company_phone: '9876543210',
        status: 'active',
      });
    }

    const roleId = '11111111-1111-1111-1111-111111111111';
    let roleObj = await Role.findByPk(roleId);
    if (!roleObj) {
      roleObj = await Role.create({
        id: roleId,
        name: 'Admin',
        slug: 'admin',
        is_system: true,
      });
    }

    let uObj = await User.findByPk(userId);
    if (!uObj) {
      uObj = await User.create({
        id: userId,
        tenant_id: tenantId,
        role_id: roleId,
        name: 'E2E User',
        email: 'e2e' + Date.now() + '@user.com',
        phone: '9876543210',
        password_hash: 'mockhash123',
      });
    }

    // Seed wallet with ₹10,000 balance
    const [wallet] = await Wallet.findOrCreate({
      where: { tenant_id: tenantId },
      defaults: { id: tenantId, tenant_id: tenantId, balance: 10000.00 },
    });
    await wallet.update({ balance: 10000.00 });

    pickupAddress = await PickupAddress.create({
      tenant_id: tenantId,
      label: 'Main Warehouse',
      contact_name: 'Warehouse Manager',
      contact_phone: '9876543210',
      phone: '9876543210',
      address_line1: 'Connaught Place',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      is_default: true,
      created_by: userId,
    });

    provider = await CourierProvider.findOne({ where: { provider_key: 'delhivery' } });
    if (!provider) {
      provider = await CourierProvider.create({
        provider_key: 'delhivery',
        display_name: 'Delhivery Surface Direct',
        is_active: true,
        credentials_encrypted: 'mock_encrypted_creds',
        config: { mock: true },
        created_by: null,
      });
    }
  });

  it('Should successfully create an order, compare rate quotes, and book a shipment end-to-end', async () => {
    const tenantId = 'e2e-tenant-1234-5678-901234567890';
    const userId = 'e2e-user-1234-5678-901234567890';

    // Step 1: Create Order
    const orderData = {
      order_reference: 'ORD-E2E-' + Date.now(),
      pickup_address_id: pickupAddress.id,
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '9876543210',
      shipping_address_line1: 'Sector 62',
      shipping_city: 'Delhi',
      shipping_state: 'Delhi',
      shipping_pincode: '110002',
      payment_mode: 'prepaid',
      weight_kg: 1.30,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      items: [
        { product_name: 'Product A', sku: 'SKU-A', quantity: 2, unit_price: 250.00 }
      ],
    };

    const createdOrder = await orderService.createOrder(tenantId, orderData, userId);
    assert.strictEqual(createdOrder.order_value, 500.00);
    assert.strictEqual(createdOrder.payment_mode, 'prepaid');

    // Step 2: Fetch Tenant Sell Rates via Markup Pricing
    const ratesResult = await pricingService.getTenantRates(createdOrder.id, tenantId, userId);
    assert.strictEqual(ratesResult.order_id, createdOrder.id);
    assert.strictEqual(ratesResult.rates.length > 0, true);

    const selectedRateObj = ratesResult.rates[0];
    assert.strictEqual(selectedRateObj.price > 0, true);
    assert.strictEqual(selectedRateObj._internal, undefined); // DTO masking verified

    // Step 3: Book Shipment
    const shipment = await shipmentService.createShipment({
      tenantId,
      userId,
      order_id: createdOrder.id,
      courier_provider_id: selectedRateObj.courier_provider_id || provider.id,
      service_type: selectedRateObj.service_type || 'surface',
      quoted_rate: selectedRateObj.price,
    });

    assert.strictEqual(shipment.order_id, createdOrder.id);
    console.log('Shipment AWB is:', shipment.awb_number);
    assert.ok(shipment.awb_number && shipment.awb_number.length > 3, 'Valid AWB number generated');
    assert.strictEqual(shipment.sell_rate, selectedRateObj.price);

    // Step 4: Verify Order status transitioned to 'shipped'
    const updatedOrder = await Order.findByPk(createdOrder.id);
    assert.strictEqual(updatedOrder.status, 'shipped');

    // Step 5: Verify CostRateSnapshot was recorded
    const snapshot = await CostRateSnapshot.findOne({ where: { shipment_id: shipment.id } });
    assert.strictEqual(snapshot !== null, true);
    assert.strictEqual(snapshot.sell_price, selectedRateObj.price);
  });
});
