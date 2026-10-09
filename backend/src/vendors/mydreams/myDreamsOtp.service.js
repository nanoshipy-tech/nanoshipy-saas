'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const MyDreamsSmsOtp = require('../../models/myDreamsSmsOtp.model');
const MyDreamsSmsTemplate = require('../../models/myDreamsSmsTemplate.model');
const myDreamsSms = require('./myDreamsSms.service');

const OTP_EXPIRY_MINUTES = 30;
const MAX_VERIFICATION_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const MAX_SENDS_PER_WINDOW = 3;

/**
 * Hash an OTP using SHA-256 with a unique cryptographic salt
 */
function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateSecureOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Check rate limit: max 3 sends per number in the last 10 minutes
 */
async function checkRateLimit(cleanPhone) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const count = await MyDreamsSmsOtp.count({
    where: {
      phone_number: cleanPhone,
      created_at: { [Op.gte]: windowStart },
    },
  });

  return count < MAX_SENDS_PER_WINDOW;
}

/**
 * Interpolate DLT {#var#} placeholders according to template and variable order
 */
function interpolateTemplate(templateText, variableOrder, valuesMap) {
  if (!templateText) return null;

  const vars = Array.isArray(variableOrder) && variableOrder.length > 0
    ? variableOrder
    : ['name', 'otp'];

  let result = templateText;
  vars.forEach(varKey => {
    const replacement = valuesMap[varKey] || valuesMap['otp'] || 'Nanoshipy';
    result = result.replace('{#var#}', replacement);
  });

  return result;
}

/**
 * Generate and send a 6-digit OTP via My Dreams Technology
 *
 * @param {string} rawPhone - 10-digit Indian mobile number
 * @param {Object} [options]
 * @param {string} [options.name] - User name or brand name
 * @param {boolean} [options.bypassDisabledCheck] - For testing
 * @returns {Promise<{ success: boolean, message: string, simulated?: boolean, error?: string }>}
 */
async function sendOtp(rawPhone, options = {}) {
  const cleanPhone = myDreamsSms.sanitizePhoneNumber(rawPhone);
  if (!cleanPhone) {
    return { success: false, error: 'INVALID_PHONE_NUMBER' };
  }

  // 1. Enforce Rate Limit: max 3 sends per 10 minutes
  const isAllowed = await checkRateLimit(cleanPhone);
  if (!isAllowed) {
    logger.warn(`[MyDreamsOtp] Rate limit exceeded for phone ${myDreamsSms.maskPhoneNumber(cleanPhone)}`);
    return {
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many OTP requests. Please wait 10 minutes before requesting again.',
    };
  }

  // 2. Fetch OTP Template & Variable Ordering
  let template = await MyDreamsSmsTemplate.findOne({ where: { template_key: 'otp', is_active: true } });
  const defaultText = 'Dear {#var#}, Your OTP for login to {#var#}. Valid for 30 minutes. Please do not share this OTP. Regards, My Dreams Technology Team';
  const templateText = template?.template_text || defaultText;
  const variableOrder = template?.variable_order || ['name', 'otp'];

  // 3. Generate Secure 6-digit OTP & Hash it
  const otpCode = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(otpCode, salt);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // 4. Construct SMS message
  const valuesMap = {
    name: options.name || 'Valued User',
    brand: 'Nanoshipy',
    otp: otpCode,
  };

  const messageText = interpolateTemplate(templateText, variableOrder, valuesMap);

  // 5. Save Hashed OTP Record in Database
  await MyDreamsSmsOtp.create({
    phone_number: cleanPhone,
    otp_hash: otpHash,
    salt,
    attempts: 0,
    expires_at: expiresAt,
  });

  // 6. Dispatch SMS (OTP code is never logged in plain text)
  const dispatchRes = await myDreamsSms.sendSMS({
    to: cleanPhone,
    message: messageText,
    templateKey: 'otp',
    bypassDisabledCheck: !!options.bypassDisabledCheck,
  });

  if (!dispatchRes.success && !dispatchRes.skipped) {
    return {
      success: false,
      error: dispatchRes.error || 'SMS_DISPATCH_FAILED',
      message: 'Failed to send OTP SMS via My Dreams Technology.',
    };
  }

  return {
    success: true,
    simulated: !!dispatchRes.simulated,
    message: `OTP sent successfully to ${myDreamsSms.maskPhoneNumber(cleanPhone)}. Valid for 30 minutes.`,
  };
}

/**
 * Verify an entered OTP against the hashed store
 *
 * @param {string} rawPhone - 10-digit mobile
 * @param {string} enteredOtp - 6-digit entered OTP
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function verifyOtp(rawPhone, enteredOtp) {
  const cleanPhone = myDreamsSms.sanitizePhoneNumber(rawPhone);
  if (!cleanPhone || !enteredOtp) {
    return { valid: false, error: 'INVALID_INPUT' };
  }

  const cleanOtp = String(enteredOtp).trim();

  // Find latest active OTP for this phone
  const otpRecord = await MyDreamsSmsOtp.findOne({
    where: {
      phone_number: cleanPhone,
      verified_at: null,
    },
    order: [['created_at', 'DESC']],
  });

  if (!otpRecord) {
    return { valid: false, error: 'NO_ACTIVE_OTP' };
  }

  // Check Expiry (30 minutes)
  if (new Date() > new Date(otpRecord.expires_at)) {
    return { valid: false, error: 'OTP_EXPIRED' };
  }

  // Check Attempt Limit (Max 5 attempts)
  if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return { valid: false, error: 'MAX_ATTEMPTS_EXCEEDED' };
  }

  // Compare Hashes
  const calculatedHash = hashOtp(cleanOtp, otpRecord.salt);
  if (calculatedHash !== otpRecord.otp_hash) {
    await otpRecord.increment('attempts', { by: 1 });
    return { valid: false, error: 'INVALID_OTP' };
  }

  // Success: mark verified and invalidate record
  otpRecord.verified_at = new Date();
  await otpRecord.save();

  return { valid: true };
}

module.exports = {
  sendOtp,
  verifyOtp,
  generateSecureOtp,
  hashOtp,
};
