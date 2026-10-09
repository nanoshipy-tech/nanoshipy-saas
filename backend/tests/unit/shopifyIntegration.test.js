'use strict';

const crypto = require('crypto');
const axios = require('axios');
const {
  cleanShopDomain,
  ShopifyIntegrationService,
  encryptToken,
  decryptToken,
  generateStateNonce,
  verifyStateNonce,
} = require('../../src/services/shopifyIntegration.service');
const shopifyIntegrationService = require('../../src/services/shopifyIntegration.service');
const { ShopifyConnection, Order, PickupAddress, Tenant, sequelize } = require('../../src/models');
const eventBus = require('../../src/events/eventBus');

jest.mock('axios');

describe('Shopify Dual-Connection Integration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SHOPIFY_CLIENT_ID: 'test_client_id_123',
      SHOPIFY_CLIENT_SECRET: 'test_client_secret_xyz',
      SHOPIFY_WEBHOOK_SECRET: 'test_shared_webhook_secret',
      APP_URL: 'https://api.nanoshipy.com',
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Domain Sanitization & Formatting', () => {
    test('converts simple slug to .myshopify.com', () => {
      expect(cleanShopDomain('nano-fashion')).toBe('nano-fashion.myshopify.com');
    });

    test('preserves valid .myshopify.com domain', () => {
      expect(cleanShopDomain('nano-fashion.myshopify.com')).toBe('nano-fashion.myshopify.com');
    });

    test('strips protocol, port, path, and trailing slashes', () => {
      expect(cleanShopDomain('https://nano-fashion.myshopify.com/admin/apps/')).toBe('nano-fashion.myshopify.com');
      expect(cleanShopDomain('http://NANO-FASHION.myshopify.com:443/')).toBe('nano-fashion.myshopify.com');
    });

    test('extracts store slug from admin.shopify.com/store/slug path', () => {
      expect(cleanShopDomain('https://admin.shopify.com/store/my-special-store/orders')).toBe('my-special-store.myshopify.com');
    });
  });

  describe('2. AES-256-GCM Token Encryption & Decryption', () => {
    test('encrypts token at rest and decrypts accurately', () => {
      const plainToken = 'shpat_9876543210fedcba';
      const encrypted = encryptToken(plainToken);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainToken);
      expect(encrypted).not.toContain('shpat_');

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(plainToken);
    });

    test('returns null gracefully on tampered ciphertext', () => {
      const plainToken = 'shpat_secret_token_123';
      const encrypted = encryptToken(plainToken);
      const tampered = encrypted.substring(0, encrypted.length - 4) + 'AAAA';

      const result = decryptToken(tampered);
      expect(result).toBeNull();
    });

    test('handles null or empty inputs gracefully', () => {
      expect(encryptToken(null)).toBeNull();
      expect(decryptToken(null)).toBeNull();
      expect(decryptToken('')).toBeNull();
    });
  });

  describe('3. OAuth State Nonce Generation & Validation', () => {
    test('generates a state nonce and verifies it successfully', async () => {
      const tenantId = 'tenant-uuid-1111';
      const shopDomain = 'store-test.myshopify.com';

      const stateParam = await generateStateNonce(tenantId, shopDomain);
      expect(stateParam).toBeDefined();
      expect(stateParam.split('.')).toHaveLength(3);

      const verified = await verifyStateNonce(stateParam);
      expect(verified).toBeDefined();
      expect(verified.tenant_id).toBe(tenantId);
      expect(verified.shop_domain).toBe(shopDomain);
    });

    test('rejects tampered state parameter', async () => {
      const stateParam = await generateStateNonce('tenant-uuid-1111', 'store-test.myshopify.com');
      const tampered = stateParam.replace(/\.[a-f0-9]{16}\./, '.0000000000000000.');

      const verified = await verifyStateNonce(tampered);
      expect(verified).toBeNull();
    });

    test('rejects malformed state strings', async () => {
      expect(await verifyStateNonce('')).toBeNull();
      expect(await verifyStateNonce('malformed_string')).toBeNull();
    });
  });

  describe('4. Option A: OAuth Authorization Flow', () => {
    test('builds valid Shopify OAuth authorize URL with state and scopes', async () => {
      const tenantId = 'tenant-uuid-2222';
      const shopDomain = 'cool-gadgets.myshopify.com';

      const res = await shopifyIntegrationService.buildOAuthAuthorizeUrl(tenantId, shopDomain);

      expect(res.shop_domain).toBe('cool-gadgets.myshopify.com');
      expect(res.authorize_url).toContain('https://cool-gadgets.myshopify.com/admin/oauth/authorize');
      expect(res.authorize_url).toContain('client_id=test_client_id_123');
      expect(res.authorize_url).toContain('redirect_uri=');
      expect(res.authorize_url).toContain('state=');
      expect(res.authorize_url).toContain('read_orders');
    });

    test('rejects domain missing or non-myshopify domain', async () => {
      await expect(
        shopifyIntegrationService.buildOAuthAuthorizeUrl('tenant-1', '')
      ).rejects.toThrow('store domain is required');

      await expect(
        shopifyIntegrationService.buildOAuthAuthorizeUrl('tenant-1', 'customdomain.com')
      ).rejects.toThrow('requires your permanent ".myshopify.com" domain');
    });
  });

  describe('5. Option B: Manual Access Token Connection', () => {
    test('rejects API Secret Key (shpss_...) with clear advisory', async () => {
      await expect(
        shopifyIntegrationService.manualConnect('tenant-1', {
          shop_domain: 'test-shop.myshopify.com',
          access_token: 'shpss_secret_key_12345',
        })
      ).rejects.toThrow('You entered an API Secret Key (shpss_...)');
    });

    test('rejects tokens that do not start with shpat_', async () => {
      await expect(
        shopifyIntegrationService.manualConnect('tenant-1', {
          shop_domain: 'test-shop.myshopify.com',
          access_token: 'invalid_token_prefix',
        })
      ).rejects.toThrow('Shopify requires an Admin API Access Token starting with "shpat_"');
    });

    test('rejects when Shopify Admin API returns 401 Unauthorized', async () => {
      const err401 = new Error('Request failed with status code 401');
      err401.response = { status: 401, data: { errors: '[API] Invalid API key or access token' } };
      axios.get.mockRejectedValueOnce(err401);

      await expect(
        shopifyIntegrationService.manualConnect('tenant-1', {
          shop_domain: 'test-shop.myshopify.com',
          access_token: 'shpat_invalid_token_xyz',
        })
      ).rejects.toThrow('Invalid credentials (401 Unauthorized)');
    });

    test('successfully validates and stores encrypted token on 200 OK', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          shop: {
            id: 123456,
            name: 'Elite Super Store',
            domain: 'test-shop.myshopify.com',
          },
        },
      });

      // Mock database upsert
      const mockConnection = {
        id: 'conn-uuid-999',
        tenant_id: 'tenant-real-1',
        shop_domain: 'test-shop.myshopify.com',
        connection_method: 'manual',
        status: 'connected',
        webhook_registered: true,
        scopes: 'read_orders',
        connected_at: new Date(),
        last_synced_at: null,
        update: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConnection);

      const result = await shopifyIntegrationService.manualConnect('tenant-real-1', {
        shop_domain: 'test-shop.myshopify.com',
        access_token: 'shpat_valid_token_123',
        webhook_secret: 'shpss_optional_secret',
      });

      expect(result.connected).toBe(true);
      expect(result.shop_domain).toBe('test-shop.myshopify.com');
      expect(result.connection_method).toBe('manual');
      expect(mockConnection.update).toHaveBeenCalled();
    });
  });

  describe('6. Webhook Verification & Order Ingestion', () => {
    test('verifies webhook signature using connection custom webhook_secret', async () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1001, name: '#1001' }));
      const customSecret = 'my_custom_store_webhook_secret';
      const hmac = crypto.createHmac('sha256', customSecret).update(rawBody).digest('base64');

      const mockConn = {
        id: 'conn-1',
        tenant_id: 'tenant-1',
        shop_domain: 'store.myshopify.com',
        webhook_secret: customSecret,
        status: 'connected',
        connection_method: 'manual',
        update: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConn);
      jest.spyOn(shopifyIntegrationService, 'ingestOrder').mockResolvedValue({ status: 'created', order_id: 'ord-1' });

      const result = await shopifyIntegrationService.verifyAndProcessWebhook({
        rawBody,
        hmacHeader: hmac,
        shopDomainHeader: 'store.myshopify.com',
        topicHeader: 'orders/create',
      });

      expect(result.status).toBe(200);
      expect(shopifyIntegrationService.ingestOrder).toHaveBeenCalledWith(mockConn, { id: 1001, name: '#1001' });
    });

    test('verifies webhook signature using app client secret for OAuth shops', async () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1002, name: '#1002' }));
      const hmac = crypto.createHmac('sha256', 'test_client_secret_xyz').update(rawBody).digest('base64');

      const mockConn = {
        id: 'conn-2',
        tenant_id: 'tenant-2',
        shop_domain: 'oauth-store.myshopify.com',
        webhook_secret: null,
        status: 'connected',
        connection_method: 'oauth',
        update: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConn);
      jest.spyOn(shopifyIntegrationService, 'ingestOrder').mockResolvedValue({ status: 'created', order_id: 'ord-2' });

      const result = await shopifyIntegrationService.verifyAndProcessWebhook({
        rawBody,
        hmacHeader: hmac,
        shopDomainHeader: 'oauth-store.myshopify.com',
        topicHeader: 'orders/create',
      });

      expect(result.status).toBe(200);
    });

    test('rejects invalid or tampered HMAC signature', async () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1003 }));
      const mockConn = {
        id: 'conn-3',
        tenant_id: 'tenant-3',
        shop_domain: 'store.myshopify.com',
        webhook_secret: 'real_secret',
        status: 'connected',
      };

      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConn);

      const result = await shopifyIntegrationService.verifyAndProcessWebhook({
        rawBody,
        hmacHeader: 'invalid_base64_hmac==',
        shopDomainHeader: 'store.myshopify.com',
        topicHeader: 'orders/create',
      });

      expect(result.status).toBe(401);
      expect(result.message).toContain('Invalid webhook signature');
    });

    test('order ingestion prevents duplicate inserts for same external_order_id', async () => {
      const mockConn = {
        id: 'conn-4',
        tenant_id: 'tenant-4',
        shop_domain: 'store.myshopify.com',
      };

      const payload = {
        id: 99999,
        name: '#99999',
        financial_status: 'paid',
        total_price: '500.00',
        line_items: [],
      };

      jest.spyOn(Order, 'findOne').mockResolvedValue({ id: 'existing-order-uuid' });

      const res = await shopifyIntegrationService.ingestOrder(mockConn, payload);
      expect(res.status).toBe('skipped');
      expect(res.order_id).toBe('existing-order-uuid');
    });
  });

  describe('7. Disconnect Flow', () => {
    test('marks connection disconnected and deregisters webhooks', async () => {
      const mockConn = {
        id: 'conn-disc',
        tenant_id: 'tenant-disc',
        shop_domain: 'disc-store.myshopify.com',
        access_token: encryptToken('shpat_token_test'),
        status: 'connected',
        update: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConn);
      axios.get.mockResolvedValueOnce({ data: { webhooks: [] } });

      const res = await shopifyIntegrationService.disconnect('tenant-disc');
      expect(res.success).toBe(true);
      expect(mockConn.update).toHaveBeenCalledWith({
        status: 'disconnected',
        webhook_registered: false,
      });
    });
  });

  describe('8. Two-Way Fulfillment Push', () => {
    test('pushes fulfillment using modern Fulfillment Orders API when open fulfillment orders exist', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          fulfillment_orders: [
            { id: 101, status: 'open' },
            { id: 102, status: 'closed' },
          ],
        },
      });
      const mockPost = jest.fn().mockResolvedValue({
        data: { fulfillment: { id: 99991 } },
      });
      axios.create.mockReturnValue({ get: mockGet, post: mockPost });

      const mockConn = { shop_domain: 'nano-store.myshopify.com' };
      const res = await shopifyIntegrationService.fulfillOrder(
        mockConn,
        'shpat_live_token',
        '8888',
        'AWB123456789',
        'Delhivery',
        'https://track.nanoshipy.com?awb=AWB123456789'
      );

      expect(res.success).toBe(true);
      expect(res.fulfillmentId).toBe(99991);
      expect(mockGet).toHaveBeenCalledWith('/orders/8888/fulfillment_orders.json');
      expect(mockPost).toHaveBeenCalledWith('/fulfillments.json', expect.objectContaining({
        fulfillment: expect.objectContaining({
          tracking_info: expect.objectContaining({
            number: 'AWB123456789',
            company: 'Delhivery',
          }),
          line_items_by_fulfillment_order: [{ fulfillment_order_id: 101 }],
        }),
      }));
    });

    test('falls back to legacy fulfillments endpoint when no open fulfillment orders exist', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: { fulfillment_orders: [] },
      });
      const mockPost = jest.fn().mockResolvedValue({
        data: { fulfillment: { id: 88881 } },
      });
      axios.create.mockReturnValue({ get: mockGet, post: mockPost });

      const mockConn = { shop_domain: 'legacy-store.myshopify.com' };
      const res = await shopifyIntegrationService.fulfillOrder(
        mockConn,
        'shpat_legacy_token',
        '7777',
        'AWBLEGACY999',
        'Shipway',
        'https://track.nanoshipy.com?awb=AWBLEGACY999'
      );

      expect(res.success).toBe(true);
      expect(res.fulfillmentId).toBe(88881);
      expect(mockPost).toHaveBeenCalledWith('/orders/7777/fulfillments.json', expect.objectContaining({
        fulfillment: expect.objectContaining({
          tracking_number: 'AWBLEGACY999',
          tracking_company: 'Shipway',
        }),
      }));
    });
  });

  describe('9. Webhook Order Fulfilled Event', () => {
    test('updates order status to shipped when orders/fulfilled webhook arrives', async () => {
      const mockOrder = {
        id: 'ord-uuid-fulfilled',
        status: 'created',
        update: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Order, 'findOne').mockResolvedValue(mockOrder);

      const mockConn = { tenant_id: 'tenant-fulfilled' };
      await shopifyIntegrationService.handleOrderFulfilled(mockConn, { id: 12345 });

      expect(mockOrder.update).toHaveBeenCalledWith({ status: 'shipped' });
    });
  });

  describe('10. On-demand Sync & Orders List', () => {
    test('syncOrders fetches orders from Admin API and ingests them', async () => {
      const mockConn = {
        id: 'conn-sync-1',
        tenant_id: 'tenant-sync-1',
        shop_domain: 'sync-store.myshopify.com',
        access_token: encryptToken('shpat_sync_token'),
        status: 'connected',
        update: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue(mockConn);
      jest.spyOn(shopifyIntegrationService, 'ingestOrder').mockResolvedValue({ status: 'created', order_id: 'ord-sync-1' });

      const mockGet = jest.fn().mockResolvedValue({
        data: {
          orders: [
            { id: 9001, name: '#9001', line_items: [] },
            { id: 9002, name: '#9002', line_items: [] },
          ],
        },
      });
      axios.create.mockReturnValue({ get: mockGet });

      const result = await shopifyIntegrationService.syncOrders('tenant-sync-1');
      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(mockConn.update).toHaveBeenCalled();
    });

    test('getOrders queries tenant orders with shipments and line items', async () => {
      const mockOrders = [
        { id: 'o-1', order_reference: 'SHP-101', shipments: [], items: [] },
      ];
      jest.spyOn(ShopifyConnection, 'findOne').mockResolvedValue({ id: 'conn-get-1' });
      jest.spyOn(Order, 'findAndCountAll').mockResolvedValue({ count: 1, rows: mockOrders });

      const res = await shopifyIntegrationService.getOrders('tenant-get-1', { page: 1, limit: 10 });
      expect(res.count).toBe(1);
      expect(res.data).toHaveLength(1);
    });
  });
});
