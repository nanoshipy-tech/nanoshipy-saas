'use strict';
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

if (process.env.NODE_ENV === 'production' && !process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY) {
  throw new Error('[FATAL][Security] PROVIDER_CREDENTIALS_ENCRYPTION_KEY must be configured in production environment.');
}

const SECRET_KEY = process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY || 'shipping-saas-provider-creds-key32!';
// Ensure exactly 32 bytes
const KEY = crypto.createHash('sha256').update(SECRET_KEY).digest();

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    if (parts.length !== 3) return text; // fallback if plain text
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

function maskSecret(text) {
  if (!text) return 'Not set';
  const dec = decrypt(text) || text;
  if (dec.length <= 4) return '••••' + dec;
  return '••••••••' + dec.slice(-4);
}

module.exports = {
  encrypt,
  decrypt,
  maskSecret,
};
