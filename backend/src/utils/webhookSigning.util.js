'use strict';

const crypto = require('crypto');

/**
 * Generates an HMAC-SHA256 signature for a webhook payload.
 * Format: sha256=<hex>
 */
function generateSignature(payload, secret) {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Generates timestamped HMAC-SHA256 signature:
 * HMAC-SHA256(secret, `${timestamp}.${rawBody}`) hex
 */
function generateTimestampedSignature(payload, secret, timestamp) {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const dataToSign = `${timestamp}.${payloadString}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataToSign);
  return hmac.digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature.
 */
function verifySignature(signature, payload, secret) {
  const expectedSignature = generateSignature(payload, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verifies timestamped HMAC-SHA256 signature with max age check (e.g. 5 minutes).
 */
function verifyTimestampedSignature(signature, payload, secret, timestamp, maxAgeMs = 300000) {
  try {
    const now = Date.now();
    const tsTime = new Date(timestamp).getTime();
    if (isNaN(tsTime) || Math.abs(now - tsTime) > maxAgeMs) {
      return false; // Stale or invalid timestamp
    }

    const expectedHex = generateTimestampedSignature(payload, secret, timestamp);
    const cleanSignature = signature.replace(/^sha256=/i, '');
    const a = Buffer.from(cleanSignature, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  generateSignature,
  generateTimestampedSignature,
  verifySignature,
  verifyTimestampedSignature,
};
