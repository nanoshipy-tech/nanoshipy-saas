'use strict';

/**
 * ProviderError — Normalizes courier-specific error codes into platform-standard categories.
 *
 * This ensures downstream code (Module 7's rate comparison, Module 8's tracking) never needs
 * to special-case a specific courier's error format. All adapters produce ProviderErrors.
 *
 * Standard error categories:
 *   INVALID_PINCODE        — Pickup or delivery pincode not serviceable / invalid
 *   SERVICE_UNAVAILABLE    — Courier API is down or service temporarily unavailable
 *   AUTH_FAILED            — Credentials rejected by the courier API
 *   RATE_LIMIT             — Courier API rate limit exceeded
 *   WEIGHT_EXCEEDED        — Package weight exceeds provider's limit
 *   SHIPMENT_NOT_FOUND     — AWB number not found in the provider's system
 *   UNKNOWN                — Uncategorized error from the courier
 */
const ERROR_CATEGORIES = {
  INVALID_PINCODE: 'INVALID_PINCODE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AUTH_FAILED: 'AUTH_FAILED',
  RATE_LIMIT: 'RATE_LIMIT',
  WEIGHT_EXCEEDED: 'WEIGHT_EXCEEDED',
  SHIPMENT_NOT_FOUND: 'SHIPMENT_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
};

class ProviderError extends Error {
  /**
   * @param {string} category - One of ERROR_CATEGORIES
   * @param {string} message - Human-readable description
   * @param {object} [context={}] - Additional context (MUST NOT contain credentials)
   * @param {string|number} [providerCode] - The raw error code from the courier API
   */
  constructor(category, message, context = {}, providerCode = null) {
    super(message);
    this.name = 'ProviderError';
    this.category = ERROR_CATEGORIES[category] || ERROR_CATEGORIES.UNKNOWN;
    this.context = context;
    this.providerCode = providerCode;
  }

  /**
   * Strip any credential fields from error context before logging.
   * Call this whenever logging an error that originated from an adapter call.
   *
   * @param {object} errorOrContext - The error object or context to sanitize
   * @returns {object} - Sanitized copy safe for logging
   */
  static sanitizeForLogging(errorOrContext) {
    const CREDENTIAL_FIELDS = [
      'api_key', 'api_secret', 'secret', 'password', 'token', 'auth_token',
      'access_token', 'client_secret', 'private_key', 'credentials',
      'credentials_encrypted', 'key', 'secret_key',
    ];

    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        const lk = k.toLowerCase();
        if (CREDENTIAL_FIELDS.some(f => lk.includes(f))) {
          clean[k] = '***MASKED***';
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          clean[k] = sanitize(v);
        } else {
          clean[k] = v;
        }
      }
      return clean;
    };

    return sanitize(errorOrContext);
  }

  toJSON() {
    return {
      name: this.name,
      category: this.category,
      message: this.message,
      providerCode: this.providerCode,
    };
  }
}

ProviderError.CATEGORIES = ERROR_CATEGORIES;

module.exports = ProviderError;
