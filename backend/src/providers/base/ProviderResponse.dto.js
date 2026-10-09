'use strict';

/**
 * ProviderResponse — Standardized response wrapper for all courier adapter methods.
 *
 * Every adapter method MUST return a ProviderResponse. This normalizes the wildly different
 * response shapes from real courier APIs into a single predictable contract before business logic
 * ever touches the data.
 *
 * Shape: { success: boolean, data: object|null, providerRawResponse: object|null, error: ProviderError|null }
 */
class ProviderResponse {
  constructor({ success, data, providerRawResponse, error }) {
    this.success = success;
    this.data = data || null;
    this.providerRawResponse = providerRawResponse || null;
    this.error = error || null;
  }

  /**
   * Create a successful response.
   * @param {object} data - Normalized adapter output data
   * @param {object} [raw={}] - The raw provider API response (for debugging/audit)
   * @returns {ProviderResponse}
   */
  static ok(data, raw = {}) {
    return new ProviderResponse({ success: true, data, providerRawResponse: raw, error: null });
  }

  /**
   * Create a failure response.
   * @param {ProviderError} error - Normalized provider error
   * @param {object} [raw={}] - The raw provider API response
   * @returns {ProviderResponse}
   */
  static fail(error, raw = {}) {
    return new ProviderResponse({ success: false, data: null, providerRawResponse: raw, error });
  }
}

module.exports = ProviderResponse;
