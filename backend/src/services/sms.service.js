'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Clean & normalize Indian phone numbers to 10 digits or E.164
 */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Send SMS using configured Gateway (Fast2SMS, MSG91) or Sandbox Mock
 * Supports both signatures:
 *   sendSMS({ to, message })
 *   sendSMS(to, message)
 */
const sendSMS = async (toOrObj, maybeMessage) => {
  let to;
  let message;
  let otp;

  if (typeof toOrObj === 'object' && toOrObj !== null) {
    to = toOrObj.to || toOrObj.phone || toOrObj.recipient;
    message = toOrObj.message || toOrObj.text || toOrObj.body;
    otp = toOrObj.otp || toOrObj.otpValue;
  } else {
    to = toOrObj;
    message = maybeMessage;
  }

  // Auto-detect OTP from message text if not explicitly provided
  if (!otp && message) {
    const otpMatch = String(message).match(/\b\d{4,6}\b/);
    if (otpMatch) {
      otp = otpMatch[0];
    }
  }

  const cleanPhone = normalizePhone(to);
  if (!cleanPhone || cleanPhone.length < 10) {
    logger.warn(`[SMSService] Invalid recipient phone number for SMS: "${to}"`);
    return { success: false, error: 'INVALID_PHONE' };
  }

  try {
    let settingsMap = {};
    try {
      const { PlatformSetting } = require('../models');
      if (PlatformSetting) {
        const rows = await PlatformSetting.findAll({
          where: {
            setting_key: ['sms_provider', 'sms_sender_id', 'sms_api_key', 'sms_enabled', 'dlt_entity_id'],
          },
        });
        rows.forEach(r => { settingsMap[r.setting_key] = r.setting_value; });
      }
    } catch (dbErr) {
      // Non-fatal if DB not yet queried
    }

    const isEnabled = settingsMap.sms_enabled !== 'false';
    if (!isEnabled) {
      logger.info(`[SMSService] SMS gateway is disabled by platform setting. Skipped send to ${cleanPhone}.`);
      return { success: true, skipped: true };
    }

    const apiKey = settingsMap.sms_api_key || process.env.SMS_API_KEY || process.env.APITXT_AUTH_KEY || process.env.FAST2SMS_API_KEY || process.env.MSG91_AUTH_KEY;
    const provider = (settingsMap.sms_provider || process.env.SMS_PROVIDER || 'apitxt').toLowerCase().trim();
    const senderId = settingsMap.sms_sender_id || process.env.SMS_SENDER_ID || 'NSHIPY';

    logger.info(`[SMSService] Dispatching SMS to ${cleanPhone} via ${provider}. Message: "${message}"`);

    // 0. My Dreams Technology Integration (app.mydreamstechnology.in)
    if ((provider === 'mydreams' || provider === 'mydreamstechnology') && apiKey && apiKey.length > 3) {
      try {
        const myDreamsAdapter = require('../vendors/mydreams/myDreamsSms.service');
        return await myDreamsAdapter.sendSMS({
          to: cleanPhone,
          message,
          otp,
          apiKey,
          senderId: senderId || 'MDTDMO',
        });
      } catch (myDreamsErr) {
        logger.error(`[SMSService] MyDreamsTechnology dispatch error: ${myDreamsErr.message}`);
        return { success: false, provider: 'mydreams', error: myDreamsErr.message };
      }
    }

    // 1. Apitxt OTP API Integration (3 Parameters: authkey, mobile, otp)
    if ((provider === 'apitxt' || provider === 'apitxt_otp') && apiKey && apiKey.length > 5) {
      if (!otp) {
        logger.warn(`[SMSService] Apitxt requires an OTP value, but none was provided or detected in message.`);
      } else {
        try {
          const mobileWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
          const postParams = new URLSearchParams({
            authkey: apiKey.trim(),
            mobile: mobileWithCountry,
            otp: String(otp).trim(),
          });

          const response = await axios.post(
            'https://apitxt.com/api/sendOTP',
            postParams.toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              timeout: 10000,
            }
          );

          if (response.data && (response.data.status === 'success' || response.data.data?.request_id)) {
            const reqId = response.data.data?.request_id || `apitxt-${Date.now()}`;
            logger.info(`[SMSService] Apitxt OTP successfully dispatched to ${cleanPhone}. Request ID: ${reqId}`);
            return {
              success: true,
              provider: 'apitxt',
              messageId: reqId,
              data: response.data,
            };
          } else {
            logger.warn(`[SMSService] Apitxt returned non-success response: ${JSON.stringify(response.data)}`);
            return {
              success: false,
              provider: 'apitxt',
              error: response.data?.message || 'Apitxt OTP dispatch rejected',
            };
          }
        } catch (apiTxtErr) {
          const errMsg = apiTxtErr.response?.data?.message || apiTxtErr.message;
          logger.error(`[SMSService] Apitxt API call error: ${errMsg}`);
          return { success: false, provider: 'apitxt', error: errMsg };
        }
      }
    }

    // 2. Fast2SMS Integration
    if (provider === 'fast2sms' && apiKey && apiKey.length > 5) {
      try {
        const response = await axios.post(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            route: 'q',
            message: message,
            language: 'english',
            flash: 0,
            numbers: cleanPhone,
          },
          {
            headers: {
              authorization: apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );

        if (response.data && response.data.return) {
          logger.info(`[SMSService] Fast2SMS dispatched successfully to ${cleanPhone}. Request ID: ${response.data.request_id}`);
          return { success: true, provider: 'fast2sms', messageId: response.data.request_id };
        }
      } catch (fastErr) {
        logger.warn(`[SMSService] Fast2SMS API call warning: ${fastErr.message}. Falling back to sandbox.`);
      }
    }

    // 3. MSG91 Integration
    if (provider === 'msg91' && apiKey && apiKey.length > 5) {
      try {
        const response = await axios.post(
          'https://api.msg91.com/api/v5/flow/',
          {
            sender: senderId,
            mobiles: `91${cleanPhone}`,
            message: message,
          },
          {
            headers: {
              authkey: apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );

        return { success: true, provider: 'msg91', messageId: response.data?.request_id || `msg91-${Date.now()}` };
      } catch (msgErr) {
        logger.warn(`[SMSService] MSG91 API call warning: ${msgErr.message}. Falling back to sandbox.`);
      }
    }

    // 4. Sandbox / Mock Mode
    logger.info(`[SMSService] Sandbox Mock SMS successfully dispatched to ${cleanPhone}: "${message}"`);
    return {
      success: true,
      simulated: true,
      provider: 'sandbox',
      messageId: `mock-sms-${Date.now()}`,
    };
  } catch (err) {
    logger.error(`[SMSService] Dispatch error to ${cleanPhone}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendSMS,
};
