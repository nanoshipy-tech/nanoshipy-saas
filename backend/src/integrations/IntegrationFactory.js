'use strict';

const integrationRegistry = require('./IntegrationRegistry');
const crypto = require('crypto');

class IntegrationFactory {
  /**
   * Decrypt AES-256-GCM encrypted credentials string
   */
  static decryptCredentials(encryptedText) {
    if (!encryptedText) return {};
    const key = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY || 'shipping-saas-integration-key32!';
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedData = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).substring(0, 32)), iv);
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString());
    } catch {
      // Fallback if plain JSON or parseable format
      try {
        return JSON.parse(encryptedText);
      } catch {
        return {};
      }
    }
  }

  /**
   * Encrypt credentials object to AES-256 string
   */
  static encryptCredentials(credentialsObj) {
    const key = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY || 'shipping-saas-integration-key32!';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).substring(0, 32)), iv);
    let encrypted = cipher.update(JSON.stringify(credentialsObj));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Create initialized adapter instance
   * @param {string} integrationKey - e.g. 'shopify', 'woocommerce'
   * @param {Object} config - { credentials_encrypted, store_url, ... }
   */
  static createAdapter(integrationKey, config = {}) {
    const AdapterClass = integrationRegistry.get(integrationKey);
    const decryptedCreds = config.credentials_encrypted
      ? this.decryptCredentials(config.credentials_encrypted)
      : (config.credentials || {});

    const adapterConfig = {
      storeUrl: config.store_url || config.storeUrl || decryptedCreds.storeUrl,
      accessToken: decryptedCreds.accessToken || decryptedCreds.access_token,
      consumerKey: decryptedCreds.consumerKey || decryptedCreds.consumer_key,
      consumerSecret: decryptedCreds.consumerSecret || decryptedCreds.consumer_secret,
      apiVersion: decryptedCreds.apiVersion || '2024-01',
    };

    return new AdapterClass(adapterConfig);
  }
}

module.exports = IntegrationFactory;
