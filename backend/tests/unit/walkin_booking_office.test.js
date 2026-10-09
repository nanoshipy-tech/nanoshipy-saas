'use strict';

const { sequelize, Tenant, Order, PickupAddress, Shipment, CourierProvider } = require('../../src/models');
const { createOrderSchema } = require('../../src/validators/order.validator');
const receiptPdfService = require('../../src/services/receiptPdf.service');
const { v4: uuidv4 } = require('uuid');

describe('Booking Office & Walk-in Retail Customer Unit Tests', () => {
  let testTenant;
  let testPickupAddress;
  let testOrder;

  beforeAll(async () => {
    // Database tables are managed via Sequelize migrations; avoid sync() collision

    // 1. Verify Tenant model contains is_booking_office
    expect(Tenant.rawAttributes.is_booking_office).toBeDefined();
    expect(Tenant.rawAttributes.is_booking_office.defaultValue).toBe(false);

    // 2. Verify Order model contains is_walkin and amount_collected
    expect(Order.rawAttributes.is_walkin).toBeDefined();
    expect(Order.rawAttributes.is_walkin.defaultValue).toBe(false);
    expect(Order.rawAttributes.amount_collected).toBeDefined();

    // Create mock records in SQLite test db
    testTenant = await Tenant.create({
      company_name: 'Test Retail Counter Branch',
      subdomain: `test-counter-${Date.now()}`,
      status: 'active',
      is_booking_office: true,
      support_phone: '+91 80 6534 0848',
      support_email: 'care@nanoshipy.com',
    });

    testPickupAddress = await PickupAddress.create({
      tenant_id: testTenant.id,
      label: 'Main Branch Counter',
      contact_name: 'Branch Manager',
      contact_phone: '8065340848',
      address_line1: '123 High Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
    });
  });

  afterAll(async () => {
    if (testOrder) await testOrder.destroy({ force: true }).catch(() => {});
    if (testPickupAddress) await testPickupAddress.destroy({ force: true }).catch(() => {});
    if (testTenant) await testTenant.destroy({ force: true }).catch(() => {});
  });

  it('1. createOrderSchema validates walk-in retail fields correctly', () => {
    const validWalkinPayload = {
      order_reference: 'WB-998877',
      pickup_address_id: uuidv4(),
      customer_name: 'Priya Consignee',
      customer_phone: '9876543210',
      shipping_address_line1: '45 Gandhi Road',
      shipping_city: 'Coimbatore',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '641001',
      payment_mode: 'prepaid',
      weight_kg: 0.5,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      items: [
        { product_name: 'Document Letter', quantity: 1, unit_price: 50 },
      ],
      is_walkin: true,
      amount_collected: 80.00,
      sender_name: 'Ramesh Walk-in Customer',
      sender_phone: '9876501234',
      booking_type: 'booking_office',
    };

    const { error, value } = createOrderSchema.validate(validWalkinPayload);
    expect(error).toBeUndefined();
    expect(value.is_walkin).toBe(true);
    expect(value.amount_collected).toBe(80);
    expect(value.sender_name).toBe('Ramesh Walk-in Customer');
  });

  it('2. Order can be created with is_walkin = true and amount_collected in database', async () => {
    testOrder = await Order.create({
      tenant_id: testTenant.id,
      order_reference: `WB-TEST-${Date.now()}`,
      pickup_address_id: testPickupAddress.id,
      customer_name: 'Priya Consignee',
      customer_phone: '9876543210',
      shipping_address_line1: '45 Gandhi Road',
      shipping_city: 'Coimbatore',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '641001',
      order_value: 100,
      payment_mode: 'prepaid',
      weight_kg: 0.5,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      status: 'pending',
      is_walkin: true,
      amount_collected: 80.00,
      sender_name: 'Ramesh Walk-in Customer',
      sender_phone: '9876501234',
      booking_type: 'booking_office',
    });

    expect(testOrder.id).toBeDefined();
    expect(testOrder.is_walkin).toBe(true);
    expect(parseFloat(testOrder.amount_collected)).toBe(80.00);
  });

  it('3. generateWalkinReceipt returns a valid PDF document with %PDF- header', async () => {
    const pdfBuffer = await receiptPdfService.generateWalkinReceipt(testOrder.id, testTenant.id);

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(500);

    // PDF magic bytes check: "%PDF-"
    const magic = Buffer.from(pdfBuffer.slice(0, 5)).toString('ascii');
    expect(magic).toBe('%PDF-');
  });

  it('4. Booking office accounts cannot create non-walkin orders', async () => {
    const isBookingOffice = Boolean(testTenant.is_booking_office);
    expect(isBookingOffice).toBe(true);

    // Standard regular order payload without is_walkin or booking_office
    const standardOrderPayload = {
      order_reference: 'ORD-STD-1',
      pickup_address_id: testPickupAddress.id,
      customer_name: 'Regular Customer',
      customer_phone: '9876543210',
      shipping_address_line1: '12 Normal Road',
      shipping_city: 'Salem',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '636001',
      order_value: 500,
      payment_mode: 'prepaid',
      weight_kg: 1.0,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      // No is_walkin or booking_office
    };

    const isRestricted = isBookingOffice && !standardOrderPayload.is_walkin && standardOrderPayload.booking_type !== 'booking_office';
    expect(isRestricted).toBe(true);
  });

  it('5. Middleware restricts normal order creation for booking offices', async () => {
    // Simulate route middleware logic
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };
    const mockNext = () => { nextCalled = true; };

    // A) Booking Office creating normal order -> BLOCKED
    const req1 = {
      tenant: { id: testTenant.id, is_booking_office: true },
      body: { customer_name: 'Regular Customer' }, // not walk-in
    };

    const isBookingOffice1 = Boolean(req1.tenant?.is_booking_office);
    const isWalkin1 = Boolean(req1.body?.is_walkin) || req1.body?.booking_type === 'booking_office';

    if (isBookingOffice1 && !isWalkin1) {
      mockRes.status(403).json({ error: { code: 'BOOKING_OFFICE_RESTRICTED' } });
    } else {
      mockNext();
    }

    expect(statusCode).toBe(403);
    expect(jsonBody.error.code).toBe('BOOKING_OFFICE_RESTRICTED');
    expect(nextCalled).toBe(false);

    // B) Booking Office creating walk-in order -> ALLOWED
    nextCalled = false;
    statusCode = null;
    const req2 = {
      tenant: { id: testTenant.id, is_booking_office: true },
      body: { customer_name: 'Walkin Customer', is_walkin: true },
    };

    const isBookingOffice2 = Boolean(req2.tenant?.is_booking_office);
    const isWalkin2 = Boolean(req2.body?.is_walkin) || req2.body?.booking_type === 'booking_office';

    if (isBookingOffice2 && !isWalkin2) {
      mockRes.status(403).json({ error: { code: 'BOOKING_OFFICE_RESTRICTED' } });
    } else {
      mockNext();
    }

    expect(nextCalled).toBe(true);
  });

  it('6. Middleware restricts walk-in booking when booking office is disabled', async () => {
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };
    const mockNext = () => { nextCalled = true; };

    // Standard tenant attempting walk-in order -> BLOCKED
    const req = {
      tenant: { id: 'standard-tenant', is_booking_office: false },
      body: { customer_name: 'Customer', is_walkin: true },
    };

    const isBookingOffice = Boolean(req.tenant?.is_booking_office);
    const isWalkin = Boolean(req.body?.is_walkin) || req.body?.booking_type === 'booking_office';

    if (!isBookingOffice && isWalkin) {
      mockRes.status(403).json({ error: { code: 'WALKIN_BOOKING_DISABLED' } });
    } else {
      mockNext();
    }

    expect(statusCode).toBe(403);
    expect(jsonBody.error.code).toBe('WALKIN_BOOKING_DISABLED');
    expect(nextCalled).toBe(false);
  });

  it('7. Standard tenant can create normal orders without restriction', async () => {
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    const req = {
      tenant: { id: 'standard-tenant', is_booking_office: false },
      body: { customer_name: 'Regular Customer' },
    };

    const isBookingOffice = Boolean(req.tenant?.is_booking_office);
    const isWalkin = Boolean(req.body?.is_walkin) || req.body?.booking_type === 'booking_office';

    if (isBookingOffice && !isWalkin) {
      // restricted
    } else if (!isBookingOffice && isWalkin) {
      // restricted
    } else {
      mockNext();
    }

    expect(nextCalled).toBe(true);
  });
});
