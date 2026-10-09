'use strict';

const {
  cleanShopDomain,
  getApiBase,
  validateCredentials,
  fetchOrdersSince,
} = require('../../src/services/shopifyConnector.service');
const axios = require('axios');

jest.mock('axios');

describe('Shopify Connection & Connector Fixes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanShopDomain & getApiBase', () => {
    test('cleans raw store slug', () => {
      expect(cleanShopDomain('my-cool-store')).toBe('my-cool-store.myshopify.com');
      expect(getApiBase('my-cool-store')).toBe('https://my-cool-store.myshopify.com/admin/api/2024-04');
    });

    test('cleans domain with .myshopify.com', () => {
      expect(cleanShopDomain('my-cool-store.myshopify.com')).toBe('my-cool-store.myshopify.com');
      expect(getApiBase('my-cool-store.myshopify.com')).toBe('https://my-cool-store.myshopify.com/admin/api/2024-04');
    });

    test('cleans full https:// URL with trailing slash', () => {
      expect(cleanShopDomain('https://my-cool-store.myshopify.com/')).toBe('my-cool-store.myshopify.com');
      expect(getApiBase('https://my-cool-store.myshopify.com/')).toBe('https://my-cool-store.myshopify.com/admin/api/2024-04');
    });

    test('never generates double https:// even with http or mixed case', () => {
      const url = getApiBase('http://My-Cool-Store.myshopify.com/');
      expect(url.startsWith('https://https://')).toBe(false);
      expect(url).toBe('https://my-cool-store.myshopify.com/admin/api/2024-04');
    });

    test('handles admin path pasted by merchant', () => {
      expect(cleanShopDomain('https://my-store.myshopify.com/admin/settings')).toBe('my-store.myshopify.com');
      expect(cleanShopDomain('https://admin.shopify.com/store/quick-shop/apps')).toBe('quick-shop.myshopify.com');
    });
  });

  describe('validateCredentials', () => {
    test('succeeds when /shop.json returns store info', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: { shop: { name: 'My Super Store' } },
      });
      axios.create.mockReturnValue({ get: mockGet });

      const res = await validateCredentials('https://test-shop.myshopify.com', 'shpat_test123');
      expect(res.success).toBe(true);
      expect(res.storeName).toBe('My Super Store');
      expect(mockGet).toHaveBeenCalledWith('/shop.json');
    });

    test('falls back to /orders.json when /shop.json returns 403 Forbidden', async () => {
      const forbiddenErr = new Error('Request failed with status code 403');
      forbiddenErr.response = { status: 403, data: { errors: 'access denied' } };

      const mockGet = jest.fn()
        .mockRejectedValueOnce(forbiddenErr)
        .mockResolvedValueOnce({ data: { orders: [] } });

      axios.create.mockReturnValue({ get: mockGet });

      const res = await validateCredentials('test-shop.myshopify.com', 'shpat_test123');
      expect(res.success).toBe(true);
      expect(res.storeName).toBe('test-shop.myshopify.com');
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenNthCalledWith(1, '/shop.json');
      expect(mockGet).toHaveBeenNthCalledWith(2, '/orders.json', { params: { limit: 1, status: 'any' } });
    });

    test('returns clear message on 401 Unauthorized', async () => {
      const unauthErr = new Error('Request failed with status code 401');
      unauthErr.response = { status: 401, data: { errors: '[API] Invalid API key or access token' } };

      const mockGet = jest.fn().mockRejectedValue(unauthErr);
      axios.create.mockReturnValue({ get: mockGet });

      const res = await validateCredentials('test-shop.myshopify.com', 'shpat_invalid');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid API access token');
    });

    test('returns clear message on ENOTFOUND', async () => {
      const dnsErr = new Error('getaddrinfo ENOTFOUND invalid-nonexistent-domain.myshopify.com');
      dnsErr.code = 'ENOTFOUND';

      const mockGet = jest.fn().mockRejectedValue(dnsErr);
      axios.create.mockReturnValue({ get: mockGet });

      const res = await validateCredentials('invalid-nonexistent-domain.myshopify.com', 'shpat_xxx');
      expect(res.success).toBe(false);
      expect(res.error).toContain('could not be found');
    });
  });

  describe('fetchOrdersSince cursor pagination', () => {
    test('does not send additional query params when page_info is present', async () => {
      const mockGet = jest.fn()
        .mockResolvedValueOnce({
          data: { orders: [{ id: 101, name: '#1001' }] },
          headers: { link: '<https://test.myshopify.com/admin/api/2024-04/orders.json?page_info=next_page_token_abc>; rel="next"' },
        })
        .mockResolvedValueOnce({
          data: { orders: [{ id: 102, name: '#1002' }] },
          headers: {},
        });

      axios.create.mockReturnValue({ get: mockGet });

      const orders = await fetchOrdersSince(
        { store_url: 'test.myshopify.com' },
        'shpat_tok',
        new Date('2026-01-01')
      );

      expect(orders).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(2);

      // First call has limit and updated_at_min
      const firstCallParams = mockGet.mock.calls[0][1].params;
      expect(firstCallParams.limit).toBe(250);
      expect(firstCallParams.updated_at_min).toBeDefined();

      // Second call MUST only have limit and page_info
      const secondCallParams = mockGet.mock.calls[1][1].params;
      expect(secondCallParams).toEqual({
        limit: 250,
        page_info: 'next_page_token_abc',
      });
      expect(secondCallParams.status).toBeUndefined();
      expect(secondCallParams.updated_at_min).toBeUndefined();
    });
  });

  describe('connectShopify controller validation', () => {
    const storefrontConnectionController = require('../../src/controllers/storefrontConnection.controller');
    const storefrontConnectionService = require('../../src/services/storefrontConnection.service');

    jest.mock('../../src/services/storefrontConnection.service');

    test('rejects missing domain with ValidationError', async () => {
      const req = { body: { shop_domain: '', access_token: 'shpat_123' }, tenant: { id: 't1' } };
      const res = {};
      const next = jest.fn();

      await storefrontConnectionController.connectShopify(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.name).toBe('ValidationError');
      expect(err.message).toContain('domain is required');
    });

    test('rejects API secret key (shpss_...) with ValidationError explaining shpat_ requirement', async () => {
      const req = { body: { shop_domain: 'my-store.myshopify.com', access_token: 'shpss_secret123' }, tenant: { id: 't1' } };
      const res = {};
      const next = jest.fn();

      await storefrontConnectionController.connectShopify(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.name).toBe('ValidationError');
      expect(err.message).toContain('shpss_');
      expect(err.message).toContain('shpat_');
    });
  });
});

