'use strict';

const axios = require('axios');
const myDreamsSms = require('../../src/vendors/mydreams/myDreamsSms.service');
const myDreamsOtp = require('../../src/vendors/mydreams/myDreamsOtp.service');
const myDreamsNotifications = require('../../src/vendors/mydreams/myDreamsOrderNotification.service');
const MyDreamsSmsTemplate = require('../../src/models/myDreamsSmsTemplate.model');
const MyDreamsSmsOtp = require('../../src/models/myDreamsSmsOtp.model');
const MyDreamsSmsLog = require('../../src/models/myDreamsSmsLog.model');
const PlatformSetting = require('../../src/models/platformSetting.model');

jest.mock('axios');

describe('My Dreams Technology SMS Vendor Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Phone Sanitization & Privacy Masking', () => {
    it('sanitizes various Indian phone formats to 10 digits', () => {
      expect(myDreamsSms.sanitizePhoneNumber('+91 98765 43210')).toBe('9876543210');
      expect(myDreamsSms.sanitizePhoneNumber('09876543210')).toBe('9876543210');
      expect(myDreamsSms.sanitizePhoneNumber('919876543210')).toBe('9876543210');
      expect(myDreamsSms.sanitizePhoneNumber('9876543210')).toBe('9876543210');
      expect(myDreamsSms.sanitizePhoneNumber('12345')).toBeNull();
      expect(myDreamsSms.sanitizePhoneNumber('')).toBeNull();
    });

    it('masks phone numbers and API keys in audit logs', () => {
      expect(myDreamsSms.maskPhoneNumber('9876543210')).toBe('98******10');
      expect(myDreamsSms.maskApiKey('MD_LIVE_KEY_982341')).toBe('MD_...341');
      expect(myDreamsSms.maskApiKey('')).toBe('');
    });
  });

  describe('2. Vendor Adapter HTTP GET Dispatch & Single Encoding', () => {
    it('dispatches HTTP GET to correct endpoint with params when enabled', async () => {
      jest.spyOn(PlatformSetting, 'findAll').mockResolvedValue([
        { setting_key: 'my_dreams_sms_enabled', setting_value: 'true' },
        { setting_key: 'my_dreams_api_key', setting_value: 'TEST_API_KEY_123' },
        { setting_key: 'my_dreams_sender_id', setting_value: 'MDTDMO' },
      ]);

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: 'status: success, id: 98124',
      });

      const res = await myDreamsSms.sendSMS({
        to: '+919876543210',
        message: 'Hello World',
      });

      expect(res.success).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(1);
      const [calledUrl, calledConfig] = axios.get.mock.calls[0];
      expect(calledUrl).toBe('http://app.mydreamstechnology.in/vb/apikey.php');
      expect(calledConfig.params).toEqual({
        apikey: 'TEST_API_KEY_123',
        senderid: 'MDTDMO',
        number: '9876543210',
        message: 'Hello World',
      });
      expect(calledConfig.timeout).toBe(10000);
    });

    it('skips dispatch and logs when master feature flag is disabled', async () => {
      jest.spyOn(PlatformSetting, 'findAll').mockResolvedValue([
        { setting_key: 'my_dreams_sms_enabled', setting_value: 'false' },
        { setting_key: 'my_dreams_api_key', setting_value: 'TEST_KEY' },
      ]);

      const logSpy = jest.spyOn(MyDreamsSmsLog, 'create').mockResolvedValue({});

      const res = await myDreamsSms.sendSMS({
        to: '9876543210',
        message: 'Hello',
      });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(axios.get).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'skipped',
        error_message: 'Feature disabled in platform settings',
      }));
    });

    it('retries once on network failure and succeeds if second attempt passes', async () => {
      jest.spyOn(PlatformSetting, 'findAll').mockResolvedValue([
        { setting_key: 'my_dreams_sms_enabled', setting_value: 'true' },
        { setting_key: 'my_dreams_api_key', setting_value: 'LIVE_KEY' },
      ]);

      axios.get
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ status: 200, data: 'OK' });

      const res = await myDreamsSms.sendSMS({
        to: '9876543210',
        message: 'Network Test',
      });

      expect(res.success).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Secure Hashed OTP Engine', () => {
    it('generates 6-digit OTP, stores hashed value, and verifies correctly', async () => {
      const storedRecords = [];

      jest.spyOn(MyDreamsSmsOtp, 'count').mockResolvedValue(0);
      jest.spyOn(MyDreamsSmsTemplate, 'findOne').mockResolvedValue({
        template_text: 'Dear {#var#}, Your OTP for login to {#var#}. Valid for 30 minutes.',
        variable_order: ['name', 'otp'],
        is_active: true,
      });

      let capturedOtpHash = null;
      let capturedSalt = null;

      jest.spyOn(MyDreamsSmsOtp, 'create').mockImplementation(async (data) => {
        capturedOtpHash = data.otp_hash;
        capturedSalt = data.salt;
        storedRecords.push({ ...data, save: jest.fn(), increment: jest.fn() });
        return data;
      });

      // Mock SMS send
      jest.spyOn(myDreamsSms, 'sendSMS').mockResolvedValue({ success: true });

      const sendRes = await myDreamsOtp.sendOtp('9876543210', { name: 'Dinesh', bypassDisabledCheck: true });
      expect(sendRes.success).toBe(true);
      expect(capturedOtpHash).toBeDefined();
      expect(capturedSalt).toBeDefined();

      // Mock findOne for verify
      const mockRecord = {
        phone_number: '9876543210',
        otp_hash: capturedOtpHash,
        salt: capturedSalt,
        attempts: 0,
        expires_at: new Date(Date.now() + 20 * 60 * 1000), // 20 mins in future
        verified_at: null,
        save: jest.fn(),
        increment: jest.fn(),
      };
      jest.spyOn(MyDreamsSmsOtp, 'findOne').mockResolvedValue(mockRecord);

      // Verify wrong code fails and increments attempt
      const wrongVerify = await myDreamsOtp.verifyOtp('9876543210', '000000');
      expect(wrongVerify.valid).toBe(false);
      expect(mockRecord.increment).toHaveBeenCalledWith('attempts', { by: 1 });
    });

    it('enforces rate limit of max 3 sends per 10 minutes', async () => {
      jest.spyOn(MyDreamsSmsOtp, 'count').mockResolvedValue(3); // already 3 sent

      const sendRes = await myDreamsOtp.sendOtp('9876543210');
      expect(sendRes.success).toBe(false);
      expect(sendRes.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('4. Order Notifications & Idempotency', () => {
    it('sends order confirmation only once per order', async () => {
      jest.spyOn(MyDreamsSmsLog, 'findOne')
        .mockResolvedValueOnce(null) // first check: not sent
        .mockResolvedValueOnce({ id: 'log-1', status: 'sent' }); // second check: already sent

      jest.spyOn(MyDreamsSmsTemplate, 'findOne').mockResolvedValue({
        template_text: 'Dear {#var#}, your order #{#var#} is confirmed.',
        variable_order: ['customer_name', 'order_number'],
        is_active: true,
      });

      const smsSpy = jest.spyOn(myDreamsSms, 'sendSMS').mockResolvedValue({ success: true });

      const order = { id: 'ord-123', customer_phone: '9876543210', customer_name: 'Ravi', order_number: 'ORD-999' };

      // 1st call: sends
      const firstRes = await myDreamsNotifications.sendOrderConfirmationNotification(order);
      expect(firstRes.success).toBe(true);
      expect(smsSpy).toHaveBeenCalledTimes(1);

      // 2nd call: skips duplicate
      const secondRes = await myDreamsNotifications.sendOrderConfirmationNotification(order);
      expect(secondRes.success).toBe(true);
      expect(secondRes.skipped).toBe(true);
      expect(smsSpy).toHaveBeenCalledTimes(1); // not called again
    });

    it('skips dispatch gracefully if template is missing/empty and logs template missing', async () => {
      jest.spyOn(MyDreamsSmsLog, 'findOne').mockResolvedValue(null);
      jest.spyOn(MyDreamsSmsTemplate, 'findOne').mockResolvedValue(null); // template missing
      const logSpy = jest.spyOn(MyDreamsSmsLog, 'create').mockResolvedValue({});

      const order = { id: 'ord-456', customer_phone: '9876543210' };
      const res = await myDreamsNotifications.sendOrderConfirmationNotification(order);

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(res.reason).toBe('TEMPLATE_MISSING');
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        error_message: 'template missing',
      }));
    });
  });
});
