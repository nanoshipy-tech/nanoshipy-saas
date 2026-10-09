'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { Tenant, PlatformAdmin, CourierProvider, TenantCourierAccess, ProviderHealthLog, PlatformAuditLog } = require('../../src/models');
const sequelize = require('../../src/config/db.config');

const mockTenantId = '85f3da92-c98e-49b4-b4bf-ac087114e42a';
const mockPlatformAdminId = '85f3da92-c98e-49b4-b4bf-ac087114e42b';

// Mock auth middleware for regular tenant auth
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'd1356a2a-22a4-4599-a7ea-ac5168368c6a',
      tenant_id: mockTenantId,
      role: 'owner',
      permissions: ['courier.view'],
    };
    req.tenant = { id: mockTenantId };
    next();
  }
}));

// Mock platform admin auth middleware
jest.mock('../../src/middlewares/platformAuth.middleware', () => ({
  isPlatformAdmin: (req, res, next) => {
    req.platformAdmin = {
      id: mockPlatformAdminId,
      role: 'super_admin',
      permissions: ['courier.manage'],
    };
    next();
  },
  isPlatformAdminTemp: (req, res, next) => {
    next();
  }
}));

describe('Courier Provider Routes (Integration)', () => {
  let providerId;

  beforeAll(async () => {
    // Register mock_int_test temporarily in the registry to satisfy validation
    const registry = require('../../src/providers/ProviderRegistry');
    registry.mock_int_test = registry.mock;

    // Clean up any stale records from previous failed runs to ensure clean run
    await ProviderHealthLog.destroy({ where: {}, force: true });
    await TenantCourierAccess.destroy({ where: { tenant_id: mockTenantId }, force: true });
    await CourierProvider.destroy({ where: { provider_key: 'mock_int_test' }, force: true });
    await PlatformAuditLog.destroy({ where: { platform_admin_id: mockPlatformAdminId }, force: true });
    await PlatformAdmin.destroy({ where: { id: mockPlatformAdminId }, force: true });
    await Tenant.destroy({ where: { id: mockTenantId }, force: true });

    // Seed test Tenant and PlatformAdmin
    await Tenant.create({
      id: mockTenantId,
      company_name: 'Test Tenant Company',
      subdomain: 'test-tenant-courier',
      status: 'active',
    });

    await PlatformAdmin.create({
      id: mockPlatformAdminId,
      name: 'Platform Super Admin',
      email: 'superadmin-courier-test@test.com',
      password_hash: 'mock-hash',
      role: 'super_admin',
      status: 'active',
    });
  });

  afterAll(async () => {
    // Clean up test registry entry
    const registry = require('../../src/providers/ProviderRegistry');
    delete registry.mock_int_test;

    // Clean up test data safely to avoid wiping core systems
    await ProviderHealthLog.destroy({ where: {}, force: true });
    await TenantCourierAccess.destroy({ where: { tenant_id: mockTenantId }, force: true });
    await CourierProvider.destroy({ where: { provider_key: 'mock_int_test' }, force: true });
    await PlatformAuditLog.destroy({ where: { platform_admin_id: mockPlatformAdminId }, force: true });
    await PlatformAdmin.destroy({ where: { id: mockPlatformAdminId }, force: true });
    await Tenant.destroy({ where: { id: mockTenantId }, force: true });
  });

  describe('Platform Admin: Courier Provider CRUD & Configuration', () => {
    it('should onboard a new courier provider with masked credentials in response', async () => {
      const payload = {
        provider_key: 'mock_int_test',
        display_name: 'Mock Integration Courier',
        credentials: { api_key: 'secret-key-abc', api_secret: 'secret-val-xyz' },
        config: { base_url: 'https://integration-mock.internal', timeout_ms: 3000 },
        supports_cod: true,
        supports_prepaid: true,
        max_weight_kg: 25.0,
        service_types: ['surface', 'express'],
        priority: 10,
      };

      const res = await request(app)
        .post('/api/v1/platform/couriers')
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.provider_key).toBe('mock_int_test');
      expect(res.body.data.credentials).toBe('***MASKED***');
      expect(res.body.data.credentials_encrypted).toBeUndefined(); // Should be excluded from defaultScope

      providerId = res.body.data.id;
    });

    it('should retrieve provider detail with masked credentials', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/couriers/${providerId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider_key).toBe('mock_int_test');
      expect(res.body.data.credentials).toBe('***MASKED***');
    });

    it('should toggle courier active status', async () => {
      const res = await request(app)
        .put(`/api/v1/platform/couriers/${providerId}/toggle`)
        .send({ is_active: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(true);
    });

    it('should grant access to the test tenant', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/couriers/${providerId}/tenant-access`)
        .send({ tenant_id: mockTenantId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant_id).toBe(mockTenantId);
      expect(res.body.data.courier_provider_id).toBe(providerId);
    });
  });

  describe('Tenant Portal: Courier Information View', () => {
    it('should list available couriers for current tenant with capabilities but no credentials', async () => {
      const res = await request(app)
        .get('/api/v1/couriers');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.find(c => c.id === providerId);
      expect(found).toBeDefined();
      expect(found.display_name).toBe('Mock Integration Courier');
      expect(found.supports_cod).toBe(true);
      expect(found.service_types).toEqual(['surface', 'express']);
      
      // Ensure credentials never leak to tenant
      expect(found.credentials).toBeUndefined();
      expect(found.credentials_encrypted).toBeUndefined();
    });
  });

  describe('Platform Admin: Health Checks & Logs', () => {
    it('should execute manual health check and return latency', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/couriers/${providerId}/health-check`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.healthy).toBe(true);
      expect(res.body.data.latency_ms).toBeDefined();
    });

    it('should return health check history logs list', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/couriers/${providerId}/health-logs`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.rows[0].courier_provider_id).toBe(providerId);
    });
  });

  describe('Platform Admin: Circuit Breaker Status & Manual Reset', () => {
    it('should retrieve circuit breaker status', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/couriers/${providerId}/circuit-breaker`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.redis_state).toBeDefined();
      expect(res.body.data.database_state).toBeDefined();
      expect(res.body.data.consecutive_failures).toBeDefined();
    });

    it('should manually reset the circuit breaker status', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/couriers/${providerId}/circuit-breaker/reset`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe('closed');
    });
  });

  describe('Platform Admin: Revoke Access', () => {
    it('should revoke access from tenant and make courier disappear from tenant list', async () => {
      const revokeRes = await request(app)
        .delete(`/api/v1/platform/couriers/${providerId}/tenant-access/${mockTenantId}`);

      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/couriers');

      const found = listRes.body.data.find(c => c.id === providerId);
      expect(found).toBeUndefined();
    });
  });
});
