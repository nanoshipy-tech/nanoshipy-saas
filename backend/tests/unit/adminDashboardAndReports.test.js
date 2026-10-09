'use strict';

const assert = require('assert');
const { queryOverdueSellers } = require('../../src/controllers/adminDashboard.controller');
const { Tenant, Invoice, PlatformAdmin, WalletRechargeTransaction, sequelize } = require('../../src/models');
const { v4: uuidv4 } = require('uuid');

describe('Phase 5: Admin Dashboard & Reports Endpoints Verification', () => {
  let testKam;
  let testTenant;
  let testOverdueInvoice;
  let testPaidInvoice;

  beforeAll(async () => {
    // Seed a test KAM platform admin
    testKam = await PlatformAdmin.create({
      id: uuidv4(),
      name: 'Rohan Sharma (KAM)',
      email: `kam_${Date.now()}@nanoshipy.com`,
      password_hash: 'hash123',
      role: 'key_account_manager',
      status: 'active',
      two_factor_enabled: false,
    });

    // Seed a test merchant assigned to KAM
    testTenant = await Tenant.create({
      id: uuidv4(),
      company_name: 'Apex Electronics Pvt Ltd',
      subdomain: `apex-${Date.now()}`,
      status: 'active',
      state: 'Karnataka',
      kam_id: testKam.id,
      support_email: 'finance@apexelectronics.com',
      support_phone: '9876543210',
    });

    // Seed an overdue invoice (due_date in the past, status = 'generated')
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    testOverdueInvoice = await Invoice.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      invoice_number: `INV-OVERDUE-${Date.now()}`,
      invoice_type: 'monthly_statement',
      reference_type: 'period',
      total_amount: 15420.50,
      subtotal: 13068.22,
      cgst_amount: 1176.14,
      sgst_amount: 1176.14,
      igst_amount: 0,
      status: 'generated', // Unpaid
      due_date: yesterday,
      billing_entity_gstin: '29ABCDE1234F1Z5',
      place_of_supply: 'Karnataka',
    });

    // Seed a paid invoice (should NOT appear in overdue)
    testPaidInvoice = await Invoice.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      invoice_number: `INV-PAID-${Date.now()}`,
      invoice_type: 'shipment',
      reference_type: 'shipment',
      total_amount: 500.00,
      subtotal: 423.73,
      cgst_amount: 38.14,
      sgst_amount: 38.14,
      igst_amount: 0,
      status: 'paid', // Paid
      due_date: yesterday,
      billing_entity_gstin: '29ABCDE1234F1Z5',
      place_of_supply: 'Karnataka',
    });
  });

  afterAll(async () => {
    if (testOverdueInvoice) await testOverdueInvoice.destroy().catch(() => {});
    if (testPaidInvoice) await testPaidInvoice.destroy().catch(() => {});
    if (testTenant) await testTenant.destroy().catch(() => {});
    if (testKam) await testKam.destroy().catch(() => {});
  });

  it('queryOverdueSellers accurately aggregates overdue count and value', async () => {
    const result = await queryOverdueSellers();

    assert(result.summary.total_overdue_sellers >= 1, 'Should find at least 1 overdue seller');
    assert(result.summary.total_overdue_value >= 15420.50, 'Overdue value should include test invoice');

    const foundApex = result.sellers.find(s => s.tenant_id === testTenant.id);
    assert(foundApex, 'Apex Electronics should be listed in overdue sellers');
    assert.strictEqual(foundApex.overdue_invoices_count, 1);
    assert.strictEqual(foundApex.total_overdue_amount, 15420.50);
    assert.strictEqual(foundApex.kam_name, 'Rohan Sharma (KAM)');
    assert.strictEqual(foundApex.state, 'Karnataka');
  });

  it('queryOverdueSellers properly filters by kam_id and reconciles 100%', async () => {
    const kamScopedResult = await queryOverdueSellers({ kamId: testKam.id });

    // Should return exactly the sellers assigned to this KAM
    assert.strictEqual(kamScopedResult.sellers.length, 1);
    assert.strictEqual(kamScopedResult.sellers[0].tenant_id, testTenant.id);
    assert.strictEqual(kamScopedResult.summary.total_overdue_value, 15420.50);
    assert.strictEqual(kamScopedResult.summary.total_overdue_sellers, 1);
  });

  it('excludes non-assigned sellers when queried by KeyAccountManager role', async () => {
    const fakeOtherAdmin = { id: uuidv4(), role: 'key_account_manager' };
    const emptyResult = await queryOverdueSellers({ callerAdmin: fakeOtherAdmin });

    assert.strictEqual(emptyResult.sellers.length, 0);
    assert.strictEqual(emptyResult.summary.total_overdue_value, 0);
  });
});
