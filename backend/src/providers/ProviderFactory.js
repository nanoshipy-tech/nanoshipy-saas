'use strict';

const registry = require('./ProviderRegistry');
const { ProviderNotFoundError } = require('./errors');
const circuitBreaker = require('./shared/circuitBreaker.util');

/**
 * ProviderFactory
 *
 * Resolves a provider key to its instantiated adapter class.
 */
class ProviderFactory {
  /**
   * Resolve and instantiate an adapter.
   *
   * @param {string} providerKey - Key matching registry, e.g., 'mock'
   * @param {object} credentials - Decrypted provider credentials object
   * @param {object} config - Provider configuration object
   * @param {string} [providerId=null] - UUID of the provider record
   * @returns {Promise<CourierProviderAdapter>} Instance of Resolved Courier Adapter
   * @throws {ProviderNotFoundError} If key is unregistered
   * @throws {CircuitBreakerOpenError} If the provider is currently open-circuited
   */
  static async getAdapter(providerKey, credentials, config, providerId = null) {
    if (providerId) {
      await circuitBreaker.checkBreakerState(providerId, providerKey);
    }
    const AdapterClass = registry[providerKey];
    if (!AdapterClass) {
      throw new ProviderNotFoundError(providerKey);
    }
    return new AdapterClass(credentials, config);
  }
}

module.exports = ProviderFactory;
