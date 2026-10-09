'use strict';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const {
  Tenant,
  Wallet,
  WalletTransaction,
  WalletAdjustment,
  PlatformAdmin,
  PlatformAuditLog,
  sequelize,
} = require('../../src/models');
const { adjustWallet } = require('../../src/controllers/platformTenant.controller');
const { updateAdminRole } = require('../../src/controllers/platformAuth.controller');

describe('Phase 7: Admin Wallet Adjustment Fix & RBAC Management', () => {
  let superAdmin;
  let testAdmin;
  let testTenant;
  let testWallet;

  beforeAll(async () => {
    // 1. Create Super Admin
    superAdmin = await PlatformAdmin.create({
      id: uuidv4(),
      name: 'Super Admin User',
      email: `super_${Date.now()}@nanoshipy.com`,
      password_hash: 'hash123',
      role: 'super_admin',
      status: 'active',
      two_factor_enabled: false,
    });

    // 2. Create Target Admin (initially platform_staff)
    testAdmin = await PlatformAdmin.create({
      id: uuidv4(),
      name: 'Target Admin',
      email: `staff_${Date.now()}@nanoshipy.com`,
      password_hash: 'hash123',
      role: 'platform_staff',
      status: 'active',
      two_factor_enabled: false,
    });

    // 3. Create Tenant & Wallet
    testTenant = await Tenant.create({
      id: uuidv4(),
      company_name: `Wallet Test Tenant ${Date.now()}`,
      subdomain: `wallet-${Date.now()}`,
      status: 'active',
      state: 'Karnataka',
    });

    testWallet = await Wallet.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      balance: 1000.0,
      held_balance: 0.0,
    });
  });

  afterAll(async () => {
    await WalletAdjustment.destroy({ where: { tenant_id: testTenant.id } }).catch(() => {});
    await WalletTransaction.destroy({ where: { tenant_id: testTenant.id } }).catch(() => {});
    await Wallet.destroy({ where: { id: testWallet.id } }).catch(() => {});
    await Tenant.destroy({ where: { id: testTenant.id } }).catch(() => {});
    await PlatformAuditLog.destroy({
      where: { platform_admin_id: [superAdmin.id, testAdmin.id] },
    }).catch(() => {});
    await PlatformAdmin.destroy({ where: { id: [superAdmin.id, testAdmin.id] } }).catch(() => {});
  });

  test('adjustWallet executes credit with valid UUID reference_id, logs audit and saves WalletAdjustment', async () => {
    const req = {
      params: { id: testTenant.id },
      body: {
        amount: 250.0,
        type: 'credit',
        reason: 'Promotional credit for shipping volume',
        idempotency_key: `IDEM-CREDIT-${Date.now()}`,
      },
      platformAdmin: { id: superAdmin.id, role: 'super_admin' },
      headers: {},
      ip: '127.0.0.1',
    };

    let resData = null;
    let resStatus = 200;
    const res = {
      status: (s) => { resStatus = s; return res; },
      json: (d) => { resData = d; return res; },
    };

    await adjustWallet(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(resData?.success, true);
    assert.strictEqual(resData?.data?.new_balance, 1250.0);

    // Verify WalletAdjustment record
    const adj = await WalletAdjustment.findOne({
      where: { id: resData.data.adjustment_id },
    });
    assert.ok(adj, 'WalletAdjustment record must exist');
    assert.strictEqual(adj.type, 'credit');
    assert.strictEqual(adj.amount, 250.0);
    assert.strictEqual(adj.admin_id, superAdmin.id);
    assert.ok(adj.reference_id, 'reference_id must be a non-null UUID');
    assert.notStrictEqual(adj.reference_id, 'ADMIN_CREDIT', 'Must not be hardcoded string ADMIN_CREDIT');

    // Verify PlatformAuditLog record
    const audit = await PlatformAuditLog.findOne({
      where: {
        platform_admin_id: superAdmin.id,
        action: 'wallet_credit_adjustment',
        entity_id: adj.id,
      },
    });
    assert.ok(audit, 'PlatformAuditLog must be created for wallet credit adjustment');
  });

  test('adjustWallet handles idempotency replay cleanly without double-crediting', async () => {
    const idempotencyKey = `IDEM-REPLAY-${Date.now()}`;
    const req = {
      params: { id: testTenant.id },
      body: {
        amount: 100.0,
        type: 'credit',
        reason: 'Single payment recharge',
        idempotency_key: idempotencyKey,
      },
      platformAdmin: { id: superAdmin.id, role: 'super_admin' },
      headers: {},
      ip: '127.0.0.1',
    };

    let firstRes = null;
    const res1 = {
      status: () => res1,
      json: (d) => { firstRes = d; return res1; },
    };
    await adjustWallet(req, res1, (err) => { if (err) throw err; });

    // Replay with identical idempotency_key
    let secondRes = null;
    const res2 = {
      status: () => res2,
      json: (d) => { secondRes = d; return res2; },
    };
    await adjustWallet(req, res2, (err) => { if (err) throw err; });

    assert.strictEqual(firstRes.data.new_balance, secondRes.data.new_balance);
    assert.ok(secondRes.data.message.includes('idempotent replay'));

    // Check count of transactions for this idempotency key
    const count = await WalletAdjustment.count({
      where: { tenant_id: testTenant.id, idempotency_key: idempotencyKey },
    });
    assert.strictEqual(count, 1, 'Only exactly 1 adjustment must be recorded for this key');
  });

  test('adjustWallet executes debit and enforces balance check', async () => {
    // Debit 500
    const req = {
      params: { id: testTenant.id },
      body: {
        amount: 500.0,
        type: 'debit',
        reason: 'Adjustment debit for invoice settlement',
      },
      platformAdmin: { id: superAdmin.id, role: 'super_admin' },
      headers: {},
      ip: '127.0.0.1',
    };

    let resData = null;
    const res = {
      status: () => res,
      json: (d) => { resData = d; return res; },
    };
    await adjustWallet(req, res, (err) => { if (err) throw err; });
    assert.strictEqual(resData.success, true);
    assert.strictEqual(resData.data.new_balance, 850.0);

    // Over-debit attempt (> 850)
    const overReq = {
      params: { id: testTenant.id },
      body: {
        amount: 999999.0,
        type: 'debit',
        reason: 'Over-debit test',
      },
      platformAdmin: { id: superAdmin.id, role: 'super_admin' },
      headers: {},
      ip: '127.0.0.1',
    };
    let overResStatus = null;
    let overResData = null;
    const overRes = {
      status: (s) => { overResStatus = s; return overRes; },
      json: (d) => { overResData = d; return overRes; },
    };
    await adjustWallet(overReq, overRes, (err) => { if (err) throw err; });
    assert.strictEqual(overResStatus, 400);
    assert.strictEqual(overResData.success, false);
  });

  test('updateAdminRole allows super_admin to update role and rejects unauthorized users', async () => {
    // 1. super_admin updates role to 'key_account_manager'
    const successReq = {
      params: { id: testAdmin.id },
      body: { role: 'key_account_manager' },
      platformAdmin: { id: superAdmin.id, role: 'super_admin' },
      ip: '127.0.0.1',
    };
    let successData = null;
    const successRes = {
      status: () => successRes,
      json: (d) => { successData = d; return successRes; },
    };
    await updateAdminRole(successReq, successRes, (err) => { if (err) throw err; });

    assert.strictEqual(successData.success, true);
    assert.strictEqual(successData.data.role, 'key_account_manager');

    // Verify in database
    await testAdmin.reload();
    assert.strictEqual(testAdmin.role, 'key_account_manager');

    // Verify audit log
    const audit = await PlatformAuditLog.findOne({
      where: {
        action: 'platform_admin_role_updated',
        entity_id: testAdmin.id,
      },
    });
    assert.ok(audit, 'PlatformAuditLog must be created for role update');
    assert.strictEqual(audit.metadata.new_role, 'key_account_manager');

    // 2. non-super_admin (e.g. role: 'finance') is blocked (HTTP 403)
    const blockedReq = {
      params: { id: testAdmin.id },
      body: { role: 'super_admin' },
      platformAdmin: { id: uuidv4(), role: 'finance' },
      ip: '127.0.0.1',
    };
    let blockedStatus = null;
    let blockedData = null;
    const blockedRes = {
      status: (s) => { blockedStatus = s; return blockedRes; },
      json: (d) => { blockedData = d; return blockedRes; },
    };
    await updateAdminRole(blockedReq, blockedRes, (err) => { if (err) throw err; });

    assert.strictEqual(blockedStatus, 403);
    assert.strictEqual(blockedData.success, false);
  });
});
