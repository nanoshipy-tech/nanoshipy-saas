'use strict';

jest.mock('../../src/models', () => {
  const mockProviderFindOne = jest.fn();
  const mockWebhookLogCreate = jest.fn();

  const mockProviderScope = jest.fn(() => ({
    findOne: mockProviderFindOne,
  }));

  return {
    CourierProvider: {
      scope: mockProviderScope,
    },
    WebhookLog: {
      create: mockWebhookLogCreate,
    },
    WebhookIdempotency: {
      findOrCreate: jest.fn(),
    },
  };
});

jest.mock('../../src/queues/webhookProcess.queue', () => {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };
});

const webhookController = require('../../src/controllers/webhook.controller');
const { CourierProvider, WebhookLog } = require('../../src/models');
const webhookProcessQueue = require('../../src/queues/webhookProcess.queue');
const crypto = require('crypto');

describe('WebhookController - Unit Tests & Security Matrix', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockProviderScope;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockReq = {
      params: { providerKey: 'shipway' },
      body: { awb: 'AWB12345', status: 'in_transit' },
      headers: {
        'x-shipway-signature': 'sha256=validsig',
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('verifySignature function', () => {
    const payload = { awb: 'AWB12345', status: 'in_transit' };
    const secret = 'my-webhook-secret-key';
    const computedSig = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    it('Scenario 1: Valid signature -> accepted', () => {
      const headers = { 'x-shipway-signature': `sha256=${computedSig}` };
      const isValid = webhookController.verifySignature('shipway', payload, headers, secret);
      expect(isValid).toBe(true);
    });

    it('Scenario 2: Invalid signature -> rejected', () => {
      const wrongSig = '0'.repeat(64);
      const headers = { 'x-shipway-signature': wrongSig };
      const isValid = webhookController.verifySignature('shipway', payload, headers, secret);
      expect(isValid).toBe(false);
    });

    it('Scenario 3: Missing signature header -> rejected', () => {
      const headers = {};
      const isValid = webhookController.verifySignature('shipway', payload, headers, secret);
      expect(isValid).toBe(false);
    });

    it('Scenario 4: Missing secret in production -> rejected', () => {
      process.env.NODE_ENV = 'production';
      const headers = { 'x-shipway-signature': computedSig };
      const isValid = webhookController.verifySignature('shipway', payload, headers, null);
      expect(isValid).toBe(false);
    });

    it('Scenario 5a: Missing secret in dev with bypass disabled -> rejected', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DEV_WEBHOOK_BYPASS;
      const headers = {};
      const isValid = webhookController.verifySignature('shipway', payload, headers, null);
      expect(isValid).toBe(false);
    });

    it('Scenario 5b: Missing secret in dev with explicit bypass enabled -> accepted', () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_WEBHOOK_BYPASS = 'true';
      const headers = {};
      const isValid = webhookController.verifySignature('shipway', payload, headers, null);
      expect(isValid).toBe(true);
    });

    it('Scenario 5c: Explicit bypass cannot bypass production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_WEBHOOK_BYPASS = 'true';
      const headers = {};
      const isValid = webhookController.verifySignature('shipway', payload, headers, null);
      expect(isValid).toBe(false);
    });

    it('Scenario 6: Malformed signature string -> rejected', () => {
      const headers = { 'x-shipway-signature': 'not-a-valid-hex-sig-short' };
      const isValid = webhookController.verifySignature('shipway', payload, headers, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('receiveWebhook HTTP handler', () => {
    it('should ignore webhooks from unknown or inactive providers', async () => {
      mockProviderScope = CourierProvider.scope();
      mockProviderScope.findOne.mockResolvedValue(null);

      await webhookController.receiveWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
      expect(WebhookLog.create).not.toHaveBeenCalled();
    });

    it('should accept valid signature webhook, log raw payload, and enqueue processing job', async () => {
      const secret = 'supersecret';
      const rawBody = mockReq.body;
      const validSig = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(rawBody))
        .digest('hex');

      mockReq.headers['x-shipway-signature'] = validSig;

      const mockProvider = {
        id: 'provider-123',
        provider_key: 'shipway',
        is_active: true,
        config: { webhook_secret: secret },
      };

      const mockWebhookLog = {
        id: 'log-123',
        update: jest.fn().mockResolvedValue(true),
      };

      mockProviderScope = CourierProvider.scope();
      mockProviderScope.findOne.mockResolvedValue(mockProvider);
      WebhookLog.create.mockResolvedValue(mockWebhookLog);

      await webhookController.receiveWebhook(mockReq, mockRes, mockNext);

      expect(WebhookLog.create).toHaveBeenCalledWith({
        courier_provider_id: 'provider-123',
        payload: mockReq.body,
        headers: mockReq.headers,
        signature_valid: false,
      });
      expect(mockWebhookLog.update).toHaveBeenCalledWith({ signature_valid: true });
      expect(webhookProcessQueue.add).toHaveBeenCalledWith(
        'webhook-log-123',
        { webhookLogId: 'log-123' },
        { jobId: 'webhook-log-123' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });

    it('should accept webhook but not enqueue if signature verification fails', async () => {
      const mockProvider = {
        id: 'provider-123',
        provider_key: 'shipway',
        is_active: true,
        config: { webhook_secret: 'supersecret' },
      };

      const mockWebhookLog = {
        id: 'log-123',
        update: jest.fn().mockResolvedValue(true),
      };

      mockReq.headers['x-shipway-signature'] = 'invalid-signature-hex-test';

      mockProviderScope = CourierProvider.scope();
      mockProviderScope.findOne.mockResolvedValue(mockProvider);
      WebhookLog.create.mockResolvedValue(mockWebhookLog);

      await webhookController.receiveWebhook(mockReq, mockRes, mockNext);

      expect(mockWebhookLog.update).toHaveBeenCalledWith({ signature_valid: false });
      expect(webhookProcessQueue.add).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });

    it('should skip enqueueing if webhook event is already processed (Fix #11)', async () => {
      const mockProvider = {
        id: 'provider-123',
        provider_key: 'shipway',
        is_active: true,
        config: { webhook_secret: 'supersecret' },
      };

      mockReq.body = {
        awb: 'AWB112233',
        status: 'in_transit',
        datetime: '2026-09-10 12:00:00',
      };

      mockProviderScope = CourierProvider.scope();
      mockProviderScope.findOne.mockResolvedValue(mockProvider);

      const { WebhookIdempotency } = require('../../src/models');
      jest.spyOn(WebhookIdempotency, 'findOrCreate').mockResolvedValue([
        { id: 'idem-1', status: 'processed' },
        false, // created = false
      ]);

      await webhookController.receiveWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true, deduplicated: true });
      expect(webhookProcessQueue.add).not.toHaveBeenCalled();
    });

    it('should safely reject non-hex signature string without timingSafeEqual TypeError (Fix #30)', () => {
      const secret = 'test-secret';
      const payload = { test: true };
      const nonHexHeader = { 'x-shipway-signature': 'NOT_A_HEX_STRING_AT_ALL_ZZZZ' };

      const result = webhookController.verifySignature('shipway', payload, nonHexHeader, secret);
      expect(result).toBe(false);
    });
  });
});
