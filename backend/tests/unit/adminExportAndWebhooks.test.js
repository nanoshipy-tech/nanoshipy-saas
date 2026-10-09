const {
  exportRegistry,
  sanitizeCellValue,
  formatISTDate,
  sanitizeFilters,
  resolveColumns,
} = require('../../src/exports/registry');

const {
  generateTimestampedSignature,
  verifyTimestampedSignature,
  generateSignature,
  verifySignature,
} = require('../../src/utils/webhookSigning.util');

const {
  isPrivateIPv4,
  isPrivateIPv6,
  validateWebhookUrl,
} = require('../../src/utils/ssrfProtector.util');

const webhookDispatcher = require('../../src/services/webhookDispatcher.service');

describe('Admin Export Registry & Security Suite', () => {
  describe('1. Export Registry & Field Sanitization', () => {
    test('should have all required entities registered', () => {
      const registeredKeys = Object.keys(exportRegistry);
      expect(registeredKeys).toContain('orders');
      expect(registeredKeys).toContain('shipments');
      expect(registeredKeys).toContain('ndr');
      expect(registeredKeys).toContain('cod_remittances');
      expect(registeredKeys).toContain('wallet_transactions');
      expect(registeredKeys).toContain('customers');
      expect(registeredKeys).toContain('support_tickets');
    });

    test('each entity should define key, label, requiredPermission, and columns', () => {
      for (const [key, config] of Object.entries(exportRegistry)) {
        expect(config.key).toBe(key);
        expect(typeof config.label).toBe('string');
        expect(typeof config.requiredPermission).toBe('string');
        expect(Array.isArray(config.columns)).toBe(true);
        expect(config.columns.length).toBeGreaterThan(0);
        for (const col of config.columns) {
          expect(typeof col.key).toBe('string');
          expect(typeof col.header).toBe('string');
        }
      }
    });

    test('sanitizeCellValue neutralizes Excel formula injection', () => {
      expect(sanitizeCellValue('=SUM(A1:B1)')).toBe("'=SUM(A1:B1)");
      expect(sanitizeCellValue('+cmd|"/C calc"!A0')).toBe("'+cmd|\"/C calc\"!A0");
      expect(sanitizeCellValue('-1+1')).toBe("'-1+1");
      expect(sanitizeCellValue('@SUM(1,2)')).toBe("'@SUM(1,2)");
      expect(sanitizeCellValue('\tCMD')).toBe("'\tCMD");
      expect(sanitizeCellValue('\rCMD')).toBe("'\rCMD");

      // Numbers should remain numbers
      expect(sanitizeCellValue(42)).toBe(42);
      expect(sanitizeCellValue(-15.5)).toBe(-15.5);
      expect(sanitizeCellValue(0)).toBe(0);

      // Safe text should not be modified
      expect(sanitizeCellValue('DELHIVERY')).toBe('DELHIVERY');
      expect(sanitizeCellValue('Standard text 123')).toBe('Standard text 123');

      // Null and undefined
      expect(sanitizeCellValue(null)).toBe('');
      expect(sanitizeCellValue(undefined)).toBe('');
    });

    test('formatISTDate formats ISO date strings in Asia/Kolkata format', () => {
      const formatted = formatISTDate('2026-10-08T10:00:00.000Z');
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2026');
      expect(formatISTDate(null)).toBe('');
    });

    test('sanitizeFilters filters out disallowed filter keys', () => {
      const sanitized = sanitizeFilters('orders', {
        status: 'shipped',
        unknown_malicious_filter: 'DROP TABLE',
        from: '2026-01-01',
      });
      expect(sanitized.status).toBe('shipped');
      expect(sanitized.from).toBe('2026-01-01');
      expect(sanitized.unknown_malicious_filter).toBeUndefined();
    });

    test('resolveColumns returns all columns if none requested or filtered subset', () => {
      const allCols = resolveColumns('orders');
      expect(allCols.length).toBe(exportRegistry.orders.columns.length);

      const subset = resolveColumns('orders', ['order_reference', 'status']);
      expect(subset.length).toBe(2);
      expect(subset.map((c) => c.key)).toEqual(['order_reference', 'status']);
    });
  });

  describe('2. Webhook HMAC-SHA256 Signing & Verification', () => {
    const secret = 'whsec_test_secret_key_1234567890';
    const rawPayload = JSON.stringify({
      id: 'evt-12345',
      event: 'export.completed',
      tenant_id: 'tenant-abc',
      data: { export_id: 'job-999', total_rows: 50 },
    });
    const nowIso = new Date().toISOString();

    test('should generate and verify valid timestamped signature', () => {
      const signature = generateTimestampedSignature(rawPayload, secret, nowIso);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // 32 bytes in hex

      const isValid = verifyTimestampedSignature(signature, rawPayload, secret, nowIso);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signature when payload is modified', () => {
      const signature = generateTimestampedSignature(rawPayload, secret, nowIso);
      const tamperedPayload = JSON.stringify({ id: 'evt-tampered' });
      const isValid = verifyTimestampedSignature(signature, tamperedPayload, secret, nowIso);
      expect(isValid).toBe(false);
    });

    test('should reject invalid signature when secret is incorrect', () => {
      const signature = generateTimestampedSignature(rawPayload, secret, nowIso);
      const isValid = verifyTimestampedSignature(signature, rawPayload, 'wrong_secret', nowIso);
      expect(isValid).toBe(false);
    });

    test('should reject timestamp older than tolerance limit (5 minutes)', () => {
      const oldTimestamp = new Date(Date.now() - 400000).toISOString(); // 400s ago
      const signature = generateTimestampedSignature(rawPayload, secret, oldTimestamp);
      const isValid = verifyTimestampedSignature(signature, rawPayload, secret, oldTimestamp, 300000);
      expect(isValid).toBe(false);
    });

    test('backward-compatible generateSignature works', () => {
      const legacySig = generateSignature(rawPayload, secret);
      expect(verifySignature(legacySig, rawPayload, secret)).toBe(true);
      expect(verifySignature('invalid_sig', rawPayload, secret)).toBe(false);
    });
  });

  describe('3. SSRF Protection & URL Validation', () => {
    test('isPrivateIPv4 detects RFC 1918 and loopback IPs', () => {
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('127.10.20.30')).toBe(true);
      expect(isPrivateIPv4('10.0.0.5')).toBe(true);
      expect(isPrivateIPv4('172.16.5.1')).toBe(true);
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('192.168.1.100')).toBe(true);
      expect(isPrivateIPv4('169.254.169.254')).toBe(true); // AWS/Cloud metadata
      expect(isPrivateIPv4('0.0.0.0')).toBe(true);

      // Public routable IPs should return false
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('1.1.1.1')).toBe(false);
      expect(isPrivateIPv4('142.250.190.46')).toBe(false);
    });

    test('isPrivateIPv6 detects IPv6 loopback, link-local and unique local', () => {
      expect(isPrivateIPv6('::1')).toBe(true);
      expect(isPrivateIPv6('fe80::1')).toBe(true);
      expect(isPrivateIPv6('fc00::1')).toBe(true);
      expect(isPrivateIPv6('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateIPv6('2607:f8b0:4005:805::200e')).toBe(false);
    });

    test('validateWebhookUrl rejects unsupported protocols', async () => {
      const fileRes = await validateWebhookUrl('file:///etc/passwd');
      expect(fileRes.isValid).toBe(false);
      expect(fileRes.error).toContain('Protocol');

      const ftpRes = await validateWebhookUrl('ftp://ftp.example.com');
      expect(ftpRes.isValid).toBe(false);

      const gopherRes = await validateWebhookUrl('gopher://gopher.example.com');
      expect(gopherRes.isValid).toBe(false);
    });

    test('validateWebhookUrl blocks direct private IPs', async () => {
      // In production mode, private IPs are blocked
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const metadataRes = await validateWebhookUrl('https://169.254.169.254/latest/meta-data');
        expect(metadataRes.isValid).toBe(false);
        expect(metadataRes.error).toContain('private IP');

        const localRes = await validateWebhookUrl('https://10.0.0.1/webhook');
        expect(localRes.isValid).toBe(false);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe('4. Webhook Retry & Exponential Backoff Logic', () => {
    test('should have backoff delays: 1m, 5m, 30m, 2h, 6h in milliseconds', () => {
      expect(webhookDispatcher.RETRY_DELAYS_MS).toEqual([
        60 * 1000,
        300 * 1000,
        1800 * 1000,
        7200 * 1000,
        21600 * 1000,
      ]);
    });

    test('calculateNextRetryDelay returns appropriate delay for each attempt', () => {
      expect(webhookDispatcher.calculateNextRetryDelay(1)).toBe(60000);
      expect(webhookDispatcher.calculateNextRetryDelay(2)).toBe(300000);
      expect(webhookDispatcher.calculateNextRetryDelay(3)).toBe(1800000);
      expect(webhookDispatcher.calculateNextRetryDelay(4)).toBe(7200000);
      expect(webhookDispatcher.calculateNextRetryDelay(5)).toBe(21600000);
      expect(webhookDispatcher.calculateNextRetryDelay(6)).toBeNull();
    });
  });
});
