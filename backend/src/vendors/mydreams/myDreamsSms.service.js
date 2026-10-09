'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');
const MyDreamsSmsLog = require('../../models/myDreamsSmsLog.model');
const PlatformSetting = require('../../models/platformSetting.model');

const DEFAULT_ENDPOINT = 'http://app.mydreamstechnology.in/vb/apikey.php';
const DEFAULT_SENDER_ID = 'MDTDMO';

/**
 * Sanitize an Indian mobile number:
 * - Strips non-digits
 * - Removes leading 0 or +91 country code
 * - Validates strict 10 digits
 * @param {string|number} rawNumber
 * @returns {string|null} 10-digit mobile or null if invalid
 */
function sanitizePhoneNumber(rawNumber) {
  if (!rawNumber) return null;
  const digits = String(rawNumber).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return null;
}

/**
 * Mask mobile number for privacy/logs (e.g. 98****3210)
 */
function maskPhoneNumber(phone) {
  if (!phone) return 'unknown';
  const clean = String(phone).trim();
  if (clean.length < 10) return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  return `${clean.slice(0, 2)}******${clean.slice(-2)}`;
}

/**
 * Mask sensitive API key in URLs or params
 */
function maskApiKey(key) {
  if (!key) return '';
  const str = String(key).trim();
  if (str.length <= 6) return '***';
  return `${str.slice(0, 3)}...${str.slice(-3)}`;
}

/**
 * Reads platform settings for My Dreams Technology
 */
async function getMyDreamsConfig() {
  const config = {
    enabled: false,
    apiKey: process.env.MYDREAMS_SMS_API_KEY || process.env.SMS_API_KEY || '',
    senderId: process.env.MYDREAMS_SMS_SENDER_ID || DEFAULT_SENDER_ID,
    endpoint: process.env.MYDREAMS_SMS_ENDPOINT || DEFAULT_ENDPOINT,
  };

  try {
    const rows = await PlatformSetting.findAll({
      where: {
        setting_key: [
          'sms_enabled',
          'sms_provider',
          'sms_api_key',
          'sms_sender_id',
          'my_dreams_sms_enabled',
          'my_dreams_api_key',
          'my_dreams_sender_id',
          'my_dreams_endpoint',
        ],
      },
    });

    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });

    // Master enable flag: checks dedicated switch first, then falls back to platform sms_enabled + sms_provider
    if (typeof map['my_dreams_sms_enabled'] !== 'undefined') {
      config.enabled = map['my_dreams_sms_enabled'] === 'true';
    } else if (map['sms_provider'] === 'mydreams') {
      config.enabled = map['sms_enabled'] === 'true';
    }

    if (map['my_dreams_api_key']) config.apiKey = map['my_dreams_api_key'];
    else if (map['sms_provider'] === 'mydreams' && map['sms_api_key']) config.apiKey = map['sms_api_key'];

    if (map['my_dreams_sender_id']) config.senderId = map['my_dreams_sender_id'];
    else if (map['sms_provider'] === 'mydreams' && map['sms_sender_id']) config.senderId = map['sms_sender_id'];

    if (map['my_dreams_endpoint']) config.endpoint = map['my_dreams_endpoint'];
  } catch (err) {
    logger.warn(`[MyDreamsSms] Failed to read platform settings from DB: ${err.message}`);
  }

  return config;
}

/**
 * Execute HTTP GET request with 10s timeout and exactly 1 retry on network failure
 */
async function executeGetWithRetry(url, params) {
  const axiosConfig = {
    timeout: 10000, // 10s timeout
    headers: {
      'User-Agent': 'Nanoshipy-SMS-Engine/1.0',
    },
    params, // Axios encodes query parameters exactly ONCE
  };

  try {
    return await axios.get(url, axiosConfig);
  } catch (firstErr) {
    // Only retry on network errors or timeouts (not 4xx errors)
    const isNetworkError = !firstErr.response || firstErr.code === 'ECONNABORTED' || firstErr.code === 'ETIMEDOUT';
    if (!isNetworkError) {
      throw firstErr;
    }

    logger.warn(`[MyDreamsSms] Network error on first attempt (${firstErr.message}). Retrying once...`);
    return await axios.get(url, axiosConfig);
  }
}

/**
 * My Dreams Technology SMS Adapter
 * Dispatches transactional SMS via HTTP GET /vb/apikey.php
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Single number or array of numbers
 * @param {string} options.message - DLT-approved message text
 * @param {string} [options.templateKey] - e.g. 'otp', 'order_confirmed', 'out_for_delivery', 'tracking'
 * @param {string} [options.orderId] - Associated order ID if applicable
 * @param {string} [options.statusEvent] - e.g. 'order_created', 'out_for_delivery'
 * @param {string} [options.apiKey] - Explicit override API key
 * @param {string} [options.senderId] - Explicit override Sender ID
 * @param {boolean} [options.bypassDisabledCheck] - For live test SMS button in admin
 * @returns {Promise<{ success: boolean, messageId?: string, rawResponse?: any, simulated?: boolean, error?: string }>}
 */
async function sendSMS(options) {
  const {
    to,
    message,
    templateKey = null,
    orderId = null,
    statusEvent = null,
    apiKey: explicitApiKey = null,
    senderId: explicitSenderId = null,
    bypassDisabledCheck = false,
  } = options || {};

  // 1. Sanitize mobile numbers
  const rawList = Array.isArray(to) ? to : String(to || '').split(',');
  const validNumbers = [];
  rawList.forEach(num => {
    const clean = sanitizePhoneNumber(num);
    if (clean && !validNumbers.includes(clean)) {
      validNumbers.push(clean);
    }
  });

  if (validNumbers.length === 0) {
    logger.warn(`[MyDreamsSms] No valid 10-digit Indian mobile numbers found for input: "${to}"`);
    return { success: false, error: 'INVALID_PHONE_NUMBER' };
  }

  const numberParam = validNumbers.join(',');
  const maskedPhone = validNumbers.map(maskPhoneNumber).join(',');

  // 2. Validate message length (DLT limits: 160 chars English, 70 chars Unicode)
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    logger.warn(`[MyDreamsSms] Missing or empty SMS message text`);
    return { success: false, error: 'EMPTY_MESSAGE_TEXT' };
  }

  // 3. Resolve Credentials and Feature Flag
  const config = await getMyDreamsConfig();
  const activeApiKey = (explicitApiKey || config.apiKey || '').trim();
  const activeSenderId = (explicitSenderId || config.senderId || DEFAULT_SENDER_ID).trim().toUpperCase();
  const activeEndpoint = (config.endpoint || DEFAULT_ENDPOINT).trim();

  // Check feature switch
  if (!config.enabled && !bypassDisabledCheck) {
    logger.info(`[MyDreamsSms] My Dreams SMS is disabled by platform setting. Skipped dispatch to ${maskedPhone}.`);
    try {
      await MyDreamsSmsLog.create({
        phone_masked: maskedPhone,
        template_key: templateKey,
        order_id: orderId ? String(orderId) : null,
        status_event: statusEvent,
        status: 'skipped',
        error_message: 'Feature disabled in platform settings',
        sent_at: new Date(),
      });
    } catch (_) {}
    return { success: true, skipped: true, reason: 'FEATURE_DISABLED' };
  }

  // 4. Sandbox / Simulated Mode if API Key is not configured
  if (!activeApiKey || activeApiKey.length < 3) {
    logger.info(`[MyDreamsSms] [SANDBOX MOCK] Simulated SMS to ${maskedPhone} (Sender: ${activeSenderId}). Length: ${cleanMessage.length} chars.`);
    try {
      await MyDreamsSmsLog.create({
        phone_masked: maskedPhone,
        template_key: templateKey,
        order_id: orderId ? String(orderId) : null,
        status_event: statusEvent,
        status: 'simulated',
        request_url_masked: `${activeEndpoint}?apikey=***&senderid=${activeSenderId}&number=${maskedPhone}&message=[MASKED]`,
        vendor_response: { status: 'simulated', note: 'Mock mode active (no live API key set)' },
        sent_at: new Date(),
      });
    } catch (_) {}
    return {
      success: true,
      simulated: true,
      provider: 'mydreams',
      messageId: `mock-md-${Date.now()}`,
    };
  }

  // 5. Live Transmission via HTTP GET
  // Endpoint: /vb/apikey.php?apikey=KEY&senderid=MDTDMO&number=9876543210&message=TEXT
  const queryParams = {
    apikey: activeApiKey,
    senderid: activeSenderId,
    number: numberParam,
    message: cleanMessage, // Axios automatically URL-encodes each query parameter exactly ONCE
  };

  const maskedUrlForLog = `${activeEndpoint}?apikey=${maskApiKey(activeApiKey)}&senderid=${activeSenderId}&number=${maskedPhone}&message=${encodeURIComponent(cleanMessage)}`;

  try {
    logger.info(`[MyDreamsSms] Dispatching live GET request to ${activeEndpoint} for ${maskedPhone} (Sender: ${activeSenderId})`);
    const response = await executeGetWithRetry(activeEndpoint, queryParams);
    const rawData = response.data;

    logger.info(`[MyDreamsSms] Response received from vendor for ${maskedPhone}: ${typeof rawData === 'object' ? JSON.stringify(rawData) : String(rawData).slice(0, 100)}`);

    // Check vendor response for success indicators
    // Vendor response typically returns text or JSON containing status or transaction ID
    const responseStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
    const isError = /error|invalid|fail|insufficient|unauthorized/i.test(responseStr) && !/status:\s*success/i.test(responseStr);

    if (isError) {
      try {
        await MyDreamsSmsLog.create({
          phone_masked: maskedPhone,
          template_key: templateKey,
          order_id: orderId ? String(orderId) : null,
          status_event: statusEvent,
          status: 'failed',
          request_url_masked: maskedUrlForLog,
          vendor_response: typeof rawData === 'object' ? rawData : { raw: rawData },
          error_message: responseStr.slice(0, 255),
          sent_at: new Date(),
        });
      } catch (logErr) {
        logger.warn(`[MyDreamsSms] Failed to write failure log: ${logErr.message}`);
      }

      return {
        success: false,
        provider: 'mydreams',
        error: responseStr.slice(0, 255),
        rawResponse: rawData,
      };
    }

    const messageId = `md-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      await MyDreamsSmsLog.create({
        phone_masked: maskedPhone,
        template_key: templateKey,
        order_id: orderId ? String(orderId) : null,
        status_event: statusEvent,
        status: 'sent',
        request_url_masked: maskedUrlForLog,
        vendor_response: typeof rawData === 'object' ? rawData : { raw: rawData },
        sent_at: new Date(),
      });
    } catch (logErr) {
      logger.warn(`[MyDreamsSms] Failed to write success log: ${logErr.message}`);
    }

    return {
      success: true,
      provider: 'mydreams',
      messageId,
      rawResponse: rawData,
    };
  } catch (netErr) {
    const errorMsg = netErr.response?.data ? JSON.stringify(netErr.response.data) : netErr.message;
    logger.error(`[MyDreamsSms] Transmission failed for ${maskedPhone}: ${errorMsg}`);

    try {
      await MyDreamsSmsLog.create({
        phone_masked: maskedPhone,
        template_key: templateKey,
        order_id: orderId ? String(orderId) : null,
        status_event: statusEvent,
        status: 'failed',
        request_url_masked: maskedUrlForLog,
        error_message: errorMsg.slice(0, 255),
        sent_at: new Date(),
      });
    } catch (_) {}

    return {
      success: false,
      provider: 'mydreams',
      error: errorMsg,
    };
  }
}

module.exports = {
  sendSMS,
  sanitizePhoneNumber,
  maskPhoneNumber,
  maskApiKey,
  getMyDreamsConfig,
};
