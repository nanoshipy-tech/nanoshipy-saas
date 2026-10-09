const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config/env');

const BCRYPT_ROUNDS = config.security.bcryptSaltRounds;
// AES-256-GCM key must be 32 bytes
const AES_KEY = Buffer.from(config.totp.encryptionKey.padEnd(32).slice(0, 32), 'utf8');

// ─── bcrypt ───────────────────────────────────────────────────────────────────

const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// ─── SHA-256 (refresh token storage) ─────────────────────────────────────────

const sha256 = (data) =>
  crypto.createHash('sha256').update(data).digest('hex');

// ─── Random token generation ──────────────────────────────────────────────────

const generateOpaqueToken = (byteLength = 64) =>
  crypto.randomBytes(byteLength).toString('hex');

const generateResetToken = () =>
  crypto.randomBytes(32).toString('hex');

// ─── AES-256-GCM (TOTP secret encryption at rest) ────────────────────────────

const encryptAES = (plaintext) => {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptAES = (ciphertext) => {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
};

module.exports = {
  hashPassword,
  comparePassword,
  sha256,
  generateOpaqueToken,
  generateResetToken,
  encryptAES,
  decryptAES,
};
