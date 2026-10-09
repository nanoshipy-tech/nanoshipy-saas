const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Configure TOTP (RFC 6238 defaults: 30s window, SHA1, 6 digits)
authenticator.options = {
  window: 1, // Allow 1 step drift (30s tolerance)
};

/**
 * Generate a new TOTP secret for a user.
 * @returns {string} Base32 encoded secret
 */
const generateSecret = () => authenticator.generateSecret();

/**
 * Generate an otpauth:// URI for QR code display.
 * @param {string} email - User email (label)
 * @param {string} secret - TOTP secret (plain, not encrypted)
 * @param {string} issuer - App/company name
 * @returns {string} otpauth URI
 */
const generateOtpAuthUri = (email, secret, issuer = 'ShippingSaaS') =>
  authenticator.keyuri(email, issuer, secret);

/**
 * Generate a base64 QR code PNG data URL for display in the browser.
 * @param {string} otpAuthUri
 * @returns {Promise<string>} data:image/png;base64,...
 */
const generateQRCode = (otpAuthUri) => QRCode.toDataURL(otpAuthUri);

/**
 * Verify a TOTP OTP code against a plain secret.
 * @param {string} token - 6-digit OTP
 * @param {string} secret - Plain (decrypted) TOTP secret
 * @returns {boolean}
 */
const verifyToken = (token, secret) => {
  try {
    return authenticator.verify({ token: String(token), secret });
  } catch {
    return false;
  }
};

module.exports = {
  generateSecret,
  generateOtpAuthUri,
  generateQRCode,
  verifyToken,
};
