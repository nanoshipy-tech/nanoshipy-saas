'use strict';

const ShopifyAdapter = require('./shopify/ShopifyAdapter');
const WooCommerceAdapter = require('./woocommerce/WooCommerceAdapter');

class IntegrationRegistry {
  constructor() {
    this.adapters = new Map();
    this.register('shopify', ShopifyAdapter);
    this.register('woocommerce', WooCommerceAdapter);
  }

  register(key, AdapterClass) {
    this.adapters.set(key.toLowerCase(), AdapterClass);
  }

  get(key) {
    const AdapterClass = this.adapters.get(key.toLowerCase());
    if (!AdapterClass) {
      throw new Error(`Integration adapter for key '${key}' not registered`);
    }
    return AdapterClass;
  }

  has(key) {
    return this.adapters.has(key.toLowerCase());
  }

  listKeys() {
    return Array.from(this.adapters.keys());
  }
}

module.exports = new IntegrationRegistry();
