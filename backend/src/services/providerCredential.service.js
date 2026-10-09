'use strict';

const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV size

// Ensure key is always exactly 32 bytes by hashing the configured secret
const getEncryptionKey = () => {
  const secret = config.provider.credentialsEncryptionKey;
  if (!secret) {
    throw new Error('PROVIDER_CREDENTIALS_ENCRYPTION_KEY is not defined in environment.');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt a JSON credentials object.
 *
 * @param {object} credentials - Plain credentials object to encrypt
 * @returns {string} Encrypted credentials represented as "iv:encryptedData:authTag" in hex
 */
const encrypt = (credentials) => {
  if (!credentials) return '';
  const text = JSON.stringify(credentials);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
};

/**
 * Decrypt credentials.
 *
 * @param {string} encryptedString - Hex formatted string "iv:encryptedData:authTag"
 * @returns {object} Decrypted plain credentials object
 */
const decrypt = (encryptedString) => {
  if (encryptedString === null || encryptedString === undefined || encryptedString === '') return null;
  if (typeof encryptedString !== 'string') return null;
  const trimmed = encryptedString.trim();
  if (trimmed === '' || trimmed === 'null') return null;
  if (trimmed === '{}') return {};

  const parts = trimmed.split(':');
  if (parts.length !== 3) {
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        throw new Error('Invalid encrypted credentials format');
      }
    }
    throw new Error('Invalid encrypted credentials format: expected "iv:encryptedData:authTag"');
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (err) {
    if (err.message.includes('Invalid encrypted credentials format')) {
      throw err;
    }
    throw new Error(`Failed to decrypt credentials: ${err.message}`);
  }
};

module.exports = {
  encrypt,
  decrypt,
};
