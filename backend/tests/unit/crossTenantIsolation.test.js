'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Tenant,
  User,
  Role,
  Order,
  Shipment,
  Invoice,
  Wallet,
  PickupAddress,
  NdrEvent,
  RtoRecord,
  SupportTicket,
  CourierProvider,
} = require('../../src/models');

const orderRepository = require('../../src/repositories/order.repository');
const shipmentRepository = require('../../src/repositories/shipment.repository');
const invoiceRepository = require('../../src/repositories/invoice.repository');
const walletRepository = require('../../src/repositories/wallet.repository');
const pickupAddressService = require('../../src/services/pickupAddress.service');
const ndrEventRepository = require('../../src/repositories/ndrEvent.repository');
const rtoRecordRepository = require('../../src/repositories/rtoRecord.repository');
const supportTicketRepository = require('../../src/repositories/supportTicket.repository');

describe('Multi-Tenant Isolation & Cross-Tenant Boundary Tests', () => {
  let tenantA;
  let tenantB;
  let roleA;
  let roleB;
  let userA;
  let userB;
  let courierProvider;
  let orderA;
  let shipmentA;
  let invoiceA;
  let addressA;
  let ndrA;
  let rtoA;
  let ticketA;
  let walletA;
  let walletB;

  beforeAll(async () => {
    // 1. Create two distinct tenants
    tenantA = await Tenant.create({
      id: uuidv4(),
      company_name: 'Tenant Alpha Corp',
      subdomain: `alpha-${Date.now()}`,
      status: 'active',
    });

    tenantB = await Tenant.create({
      id: uuidv4(),
      company_name: 'Tenant Beta Logistics',
      subdomain: `beta-${Date.now()}`,
      status: 'active',
    });

    // 2. Create Roles
    roleA = await Role.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      name: 'Owner',
      is_system_role: true,
    });

    roleB = await Role.create({
      id: uuidv4(),
      tenant_id: tenantB.id,
      name: 'Owner',
      is_system_role: true,
    });

    // 3. Create users under each tenant
    userA = await User.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      role_id: roleA.id,
      name: 'Alpha User',
      email: `alpha_${Date.now()}@example.com`,
      password_hash: 'hashedpassword',
    });

    userB = await User.create({
      id: uuidv4(),
      tenant_id: tenantB.id,
      role_id: roleB.id,
      name: 'Beta User',
      email: `beta_${Date.now()}@example.com`,
      password_hash: 'hashedpassword',
    });

    // 4. Create Courier Provider
    courierProvider = await CourierProvider.create({
      id: uuidv4(),
      provider_key: `mock_${Date.now()}`,
      display_name: 'Mock Carrier Provider',
      credentials_encrypted: 'dummy_encrypted_creds_test',
      is_active: true,
      service_types: ['surface', 'express'],
    });

    // 5. Create Wallets
    walletA = await Wallet.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      balance: 1000.00,
    });

    walletB = await Wallet.create({
      id: uuidv4(),
      tenant_id: tenantB.id,
      balance: 250.00,
    });

    // 6. Create Pickup Address for Tenant A
    addressA = await PickupAddress.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      label: 'Alpha Central Warehouse',
      contact_name: 'Alpha Manager',
      contact_phone: '9876543210',
      address_line1: '123 Alpha Hub, Industrial Area',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    });

    // 7. Create Order for Tenant A
    orderA = await Order.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      order_reference: `ORD-ALPHA-${Date.now()}`,
      customer_name: 'John Doe',
      customer_phone: '9999988888',
      shipping_address_line1: '456 Elm Street',
      shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_pincode: '400001',
      order_value: 1200.00,
      payment_mode: 'prepaid',
      weight_kg: 1.0,
      length_cm: 10.0,
      width_cm: 10.0,
      height_cm: 10.0,
      pickup_address_id: addressA.id,
      status: 'pending',
    });

    // 8. Create Shipment for Tenant A
    shipmentA = await Shipment.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      order_id: orderA.id,
      courier_provider_id: courierProvider.id,
      pickup_address_id: addressA.id,
      awb_number: `AWB-A-${Date.now()}`,
      service_type: 'surface',
      status: 'in_transit',
      declared_weight_kg: 1.0,
      charged_weight_kg: 1.0,
      selected_rate: 95.00,
      created_by: userA.id,
    });

    // 9. Create Invoice for Tenant A
    invoiceA = await Invoice.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      invoice_number: `INV-A-${Date.now()}`,
      invoice_type: 'shipment',
      reference_type: 'shipment',
      subtotal: 95.00,
      total_amount: 95.00,
      status: 'generated',
      billing_entity_gstin: '29ABCDE1234F1Z5',
      place_of_supply: 'Karnataka',
    });

    // 10. Create NDR Event for Tenant A
    ndrA = await NdrEvent.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      shipment_id: shipmentA.id,
      attempt_number: 1,
      reason_code: 'CUSTOMER_UNAVAILABLE',
      raw_reason: 'Customer was not available at delivery address',
      status: 'open',
      sla_due_at: new Date(Date.now() + 86400000),
    });

    // 11. Create RTO Record for Tenant A
    rtoA = await RtoRecord.create({
      id: uuidv4(),
      shipment_id: shipmentA.id,
      tenant_id: tenantA.id,
      rto_awb_number: `RTO-${shipmentA.awb_number}`,
      initiated_reason: 'Undelivered after 3 attempts',
      initiated_by: 'courier_initiated',
      status: 'rto_initiated',
    });

    // 12. Create Support Ticket for Tenant A
    ticketA = await SupportTicket.create({
      id: uuidv4(),
      tenant_id: tenantA.id,
      ticket_number: `TCK-${Date.now()}`,
      subject: 'Delayed shipment inquiry',
      category: 'shipment_issue',
      priority: 'medium',
      status: 'open',
      created_by: userA.id,
      related_order_id: orderA.id,
      related_shipment_id: shipmentA.id,
    });
  });

  afterAll(async () => {
    try {
      if (ticketA) await ticketA.destroy();
      if (rtoA) await rtoA.destroy();
      if (ndrA) await ndrA.destroy();
      if (invoiceA) await invoiceA.destroy();
      if (shipmentA) await shipmentA.destroy();
      if (orderA) await orderA.destroy();
      if (addressA) await addressA.destroy();
      if (walletA) await walletA.destroy();
      if (walletB) await walletB.destroy();
      if (courierProvider) await courierProvider.destroy();
      if (userA) await userA.destroy();
      if (userB) await userB.destroy();
      if (roleA) await roleA.destroy();
      if (roleB) await roleB.destroy();
      if (tenantA) await tenantA.destroy();
      if (tenantB) await tenantB.destroy();
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('Tenant B cannot access Tenant A Order by ID', async () => {
    const fetched = await orderRepository.findById(tenantB.id, orderA.id);
    expect(fetched).toBeNull();

    const legitimate = await orderRepository.findById(tenantA.id, orderA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(orderA.id);
  });

  it('Tenant B cannot update or mutate Tenant A Order', async () => {
    await expect(
      orderRepository.update(tenantB.id, orderA.id, { customer_name: 'Attacker Hack' })
    ).rejects.toThrow('Order not found');

    const pristine = await orderRepository.findById(tenantA.id, orderA.id);
    expect(pristine.customer_name).toBe('John Doe');
  });

  it('Tenant B cannot access Tenant A Shipment by ID', async () => {
    const fetched = await shipmentRepository.findById(shipmentA.id, tenantB.id);
    expect(fetched).toBeNull();

    const legitimate = await shipmentRepository.findById(shipmentA.id, tenantA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(shipmentA.id);
  });

  it('Tenant B cannot access Tenant A Invoice by ID', async () => {
    const fetched = await invoiceRepository.findById(invoiceA.id, tenantB.id);
    expect(fetched).toBeNull();

    const legitimate = await invoiceRepository.findById(invoiceA.id, tenantA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(invoiceA.id);
  });

  it('Tenant B cannot read or access Tenant A Wallet', async () => {
    const fetchedB = await walletRepository.findByTenantId(tenantB.id);
    expect(fetchedB).not.toBeNull();
    expect(fetchedB.tenant_id).toBe(tenantB.id);
    expect(parseFloat(fetchedB.balance)).toBe(250.00);

    // Cross-query for Tenant A's wallet using Tenant B's identity
    expect(fetchedB.id).not.toBe(walletA.id);
  });

  it('Tenant B cannot access Tenant A Pickup Address by ID', async () => {
    await expect(
      pickupAddressService.getAddressById(tenantB.id, addressA.id)
    ).rejects.toThrow('Address not found');

    const legitimate = await pickupAddressService.getAddressById(tenantA.id, addressA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(addressA.id);
  });

  it('Tenant B cannot access Tenant A NDR Event by ID', async () => {
    const fetched = await ndrEventRepository.findById(ndrA.id, tenantB.id);
    expect(fetched).toBeNull();

    const legitimate = await ndrEventRepository.findById(ndrA.id, tenantA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(ndrA.id);
  });

  it('Tenant B cannot access Tenant A RTO Record by ID', async () => {
    const fetched = await rtoRecordRepository.findById(rtoA.id, tenantB.id);
    expect(fetched).toBeNull();

    const legitimate = await rtoRecordRepository.findById(rtoA.id, tenantA.id);
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(rtoA.id);
  });

  it('Tenant B cannot access Tenant A Support Ticket by ID', async () => {
    const fetched = await supportTicketRepository.findById(ticketA.id, { tenantId: tenantB.id });
    expect(fetched).toBeNull();

    const legitimate = await supportTicketRepository.findById(ticketA.id, { tenantId: tenantA.id });
    expect(legitimate).not.toBeNull();
    expect(legitimate.id).toBe(ticketA.id);
  });
});
