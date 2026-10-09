'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { signPlatformAccessToken } = require('../../src/services/token.service');
const { getRedisClient } = require('../../src/config/redis.config');

describe('Module 1: Platform Destructive Routes RBAC Integration Tests', () => {
  let supportToken;
  let financeToken;
  let superAdminToken;
  const dummyTenantId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const redis = getRedisClient();

    // 1. Support Admin: only support permissions
    const supportAdminId = 'admin-support-id-01';
    supportToken = signPlatformAccessToken({
      admin_id: supportAdminId,
      email: 'support@nanoshipy.com',
      role: 'support_agent',
    });
    if (redis) {
      await redis.set(`platform_perm:${supportAdminId}`, JSON.stringify(['tenant.view', 'ticket.manage']), 'EX', 3600);
    }

    // 2. Finance Admin: finance role with finance.manage
    const financeAdminId = 'admin-finance-id-01';
    financeToken = signPlatformAccessToken({
      admin_id: financeAdminId,
      email: 'finance@nanoshipy.com',
      role: 'finance',
    });
    if (redis) {
      await redis.set(
        `platform_perm:${financeAdminId}`,
        JSON.stringify(['tenant.view', 'revenue.view', 'finance.manage']),
        'EX',
        3600
      );
    }

    // 3. Super Admin
    const superAdminId = 'admin-super-id-01';
    superAdminToken = signPlatformAccessToken({
      admin_id: superAdminId,
      email: 'super@nanoshipy.com',
      role: 'super_admin',
    });
    const { PlatformAdmin } = require('../../src/models');
    await PlatformAdmin.findOrCreate({
      where: { id: supportAdminId },
      defaults: { name: 'Support Admin', email: 'support@nanoshipy.com', password_hash: 'dummyhash', role: 'support_agent', status: 'active', token_version: 1 },
    });
    await PlatformAdmin.findOrCreate({
      where: { id: financeAdminId },
      defaults: { name: 'Finance Admin', email: 'finance@nanoshipy.com', password_hash: 'dummyhash', role: 'finance', status: 'active', token_version: 1 },
    });
    await PlatformAdmin.findOrCreate({
      where: { id: superAdminId },
      defaults: { name: 'Super Admin', email: 'super@nanoshipy.com', password_hash: 'dummyhash', role: 'super_admin', status: 'active', token_version: 1 },
    });
    if (redis) {
      await redis.set(`platform_perm:${superAdminId}`, JSON.stringify(['*']), 'EX', 3600);
    }
  });

  describe('POST /api/v1/platform/tenants/:id/wallet/adjust (requires finance.manage)', () => {
    it('should return 403 Forbidden for support admin without finance.manage', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/tenants/${dummyTenantId}/wallet/adjust`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ amount: 500, type: 'credit', reason: 'Test unauthorized adjustment' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should NOT return 403 for finance admin with finance.manage', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/tenants/${dummyTenantId}/wallet/adjust`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ amount: 500, type: 'credit', reason: 'Authorized adjustment' });

      // May be 404 (tenant not found) or 200/400, but MUST NOT be 403
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('DELETE /api/v1/platform/tenants/:id (requires super_admin)', () => {
    it('should return 403 Forbidden for non-super_admin (finance role)', async () => {
      const res = await request(app)
        .delete(`/api/v1/platform/tenants/${dummyTenantId}`)
        .set('Authorization', `Bearer ${financeToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/super admin/i);
    });

    it('should return 403 Forbidden for non-super_admin (support role)', async () => {
      const res = await request(app)
        .delete(`/api/v1/platform/tenants/${dummyTenantId}`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should NOT return 403 for super_admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/platform/tenants/${dummyTenantId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      // Will be 404 (tenant not found) or 200, but NOT 403
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('POST /api/v1/platform/tenants/:id/password (requires super_admin)', () => {
    it('should return 403 Forbidden for non-super_admin (support role)', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/tenants/${dummyTenantId}/password`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ new_password: 'TestNewPassword123!' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/super admin/i);
    });

    it('should NOT return 403 for super_admin', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/tenants/${dummyTenantId}/password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ new_password: 'TestNewPassword123!' });

      // Will be 404 (tenant not found) or 200/400, but NOT 403
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('POST /api/v1/platform/payment-gateways/:provider (requires platform_settings.manage)', () => {
    it('should return 403 Forbidden for support admin without platform_settings.manage', async () => {
      const res = await request(app)
        .post('/api/v1/platform/payment-gateways/razorpay')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ key_id: 'rzp_test_123', key_secret: 'secret123' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should NOT return 403 for super_admin', async () => {
      const res = await request(app)
        .post('/api/v1/platform/payment-gateways/razorpay')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ key_id: 'rzp_test_123', key_secret: 'secret123' });

      // Will be 200 or validation error, but NOT 403
      expect(res.statusCode).not.toBe(403);
    });
  });
});
