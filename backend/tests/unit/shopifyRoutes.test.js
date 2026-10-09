'use strict';

const request = require('supertest');
const app = require('../../src/app');
const shopifyIntegrationService = require('../../src/services/shopifyIntegration.service');

// Mock auth token helper
jest.mock('../../src/services/token.service', () => ({
  verifyAccessToken: jest.fn().mockReturnValue({
    user_id: 'user-test-123',
    tenant_id: 'tenant-test-456',
    role: 'owner',
    aud: 'tenant-user',
    token_version: 1,
  }),
  verifyPlatformAccessToken: jest.fn().mockImplementation(() => {
    throw new Error('Not platform admin');
  }),
}));

// Mock Tenant and User lookups for auth middleware
const { Tenant, User } = require('../../src/models');
jest.spyOn(Tenant, 'findByPk').mockResolvedValue({ id: 'tenant-test-456', status: 'active' });
jest.spyOn(User, 'findByPk').mockResolvedValue({
  id: 'user-test-123',
  token_version: 1,
  status: 'active',
  role: { name: 'owner', permissions: [{ key: 'order.create' }] },
});

describe('Shopify Integration Routes & Controllers', () => {
  beforeEach(() => {
    jest.spyOn(Tenant, 'findByPk').mockResolvedValue({ id: 'tenant-test-456', status: 'active' });
    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'user-test-123',
      token_version: 1,
      status: 'active',
      role: { name: 'owner', permissions: [{ key: 'order.create' }] },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/integrations/shopify/status', () => {
    test('returns status for authenticated tenant', async () => {
      jest.spyOn(shopifyIntegrationService, 'getStatus').mockResolvedValue({
        connected: true,
        shop_domain: 'cool-shop.myshopify.com',
        connection_method: 'oauth',
        status: 'connected',
        webhook_registered: true,
      });

      const res = await request(app)
        .get('/api/integrations/shopify/status')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shop_domain).toBe('cool-shop.myshopify.com');
      expect(res.body.data.connected).toBe(true);
    });

    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/integrations/shopify/status');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/integrations/shopify/disconnect', () => {
    test('disconnects store for authenticated tenant', async () => {
      jest.spyOn(shopifyIntegrationService, 'disconnect').mockResolvedValue({
        success: true,
        message: 'Shopify store disconnected successfully.',
      });

      const res = await request(app)
        .delete('/api/integrations/shopify/disconnect')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shopifyIntegrationService.disconnect).toHaveBeenCalledWith('tenant-test-456');
    });
  });

  describe('GET /api/integrations/shopify/oauth/authorize', () => {
    test('returns JSON authorize_url when requested format=json', async () => {
      jest.spyOn(shopifyIntegrationService, 'buildOAuthAuthorizeUrl').mockResolvedValue({
        authorize_url: 'https://test-shop.myshopify.com/admin/oauth/authorize?client_id=123',
        shop_domain: 'test-shop.myshopify.com',
      });

      const res = await request(app)
        .get('/api/integrations/shopify/oauth/authorize?shop=test-shop.myshopify.com&format=json')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.data.authorize_url).toContain('https://test-shop.myshopify.com/admin/oauth/authorize');
    });

    test('redirects to Shopify authorize URL when accessed directly by browser', async () => {
      jest.spyOn(shopifyIntegrationService, 'buildOAuthAuthorizeUrl').mockResolvedValue({
        authorize_url: 'https://test-shop.myshopify.com/admin/oauth/authorize?client_id=123',
        shop_domain: 'test-shop.myshopify.com',
      });

      const res = await request(app)
        .get('/api/integrations/shopify/oauth/authorize?shop=test-shop.myshopify.com')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(302);
      expect(res.header.location).toBe('https://test-shop.myshopify.com/admin/oauth/authorize?client_id=123');
    });
  });

  describe('POST /api/integrations/shopify/manual-connect', () => {
    test('connects store with valid domain and access token', async () => {
      jest.spyOn(shopifyIntegrationService, 'manualConnect').mockResolvedValue({
        id: 'conn-id-123',
        connected: true,
        shop_domain: 'manual-store.myshopify.com',
        connection_method: 'manual',
        status: 'connected',
      });

      const res = await request(app)
        .post('/api/integrations/shopify/manual-connect')
        .set('Authorization', 'Bearer valid_mock_token')
        .send({
          shop_domain: 'manual-store.myshopify.com',
          access_token: 'shpat_valid_token_123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shop_domain).toBe('manual-store.myshopify.com');
      expect(shopifyIntegrationService.manualConnect).toHaveBeenCalledWith('tenant-test-456', {
        shop_domain: 'manual-store.myshopify.com',
        access_token: 'shpat_valid_token_123',
        webhook_secret: undefined,
      });
    });
  });

  describe('POST /api/integrations/shopify/sync', () => {
    test('triggers manual sync for authenticated tenant', async () => {
      jest.spyOn(shopifyIntegrationService, 'syncOrders').mockResolvedValue({
        success: true,
        imported: 3,
        total_fetched: 5,
      });

      const res = await request(app)
        .post('/api/integrations/shopify/sync')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);
      expect(shopifyIntegrationService.syncOrders).toHaveBeenCalledWith('tenant-test-456');
    });
  });

  describe('GET /api/integrations/shopify/orders', () => {
    test('returns imported orders feed for authenticated tenant', async () => {
      jest.spyOn(shopifyIntegrationService, 'getOrders').mockResolvedValue({
        count: 2,
        data: [{ id: 'order-1' }, { id: 'order-2' }],
        page: 1,
        limit: 50,
      });

      const res = await request(app)
        .get('/api/integrations/shopify/orders?page=1&limit=50')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(2);
      expect(shopifyIntegrationService.getOrders).toHaveBeenCalledWith('tenant-test-456', { page: '1', limit: '50' });
    });
  });

  describe('GET /api/integrations/shopify/logs', () => {
    test('returns sync and webhook logs for authenticated tenant', async () => {
      jest.spyOn(shopifyIntegrationService, 'getLogs').mockResolvedValue({
        data: [{ id: 'log-1', status: 'success' }],
      });

      const res = await request(app)
        .get('/api/integrations/shopify/logs')
        .set('Authorization', 'Bearer valid_mock_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toHaveLength(1);
      expect(shopifyIntegrationService.getLogs).toHaveBeenCalledWith('tenant-test-456');
    });
  });

  describe('POST /api/integrations/shopify/webhooks/orders', () => {
    test('processes order webhook and returns 200', async () => {
      jest.spyOn(shopifyIntegrationService, 'verifyAndProcessWebhook').mockResolvedValue({
        status: 200,
        message: 'Webhook processed successfully',
      });

      const res = await request(app)
        .post('/api/integrations/shopify/webhooks/orders')
        .set('x-shopify-shop-domain', 'test-store.myshopify.com')
        .set('x-shopify-hmac-sha256', 'mock_hmac_hash')
        .set('x-shopify-topic', 'orders/create')
        .send({ id: 12345, name: '#12345' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shopifyIntegrationService.verifyAndProcessWebhook).toHaveBeenCalled();
    });
  });
});
