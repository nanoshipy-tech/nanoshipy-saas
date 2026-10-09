'use strict';

const registry = require('./ChannelRegistry');
const logger = require('../utils/logger');

class ChannelFactory {
  constructor() {
    this.instances = {};
  }

  /**
   * Resolves a cached channel adapter instance.
   * @param {string} channelKey - email, sms, whatsapp, inapp
   */
  getChannel(channelKey) {
    const key = channelKey.toLowerCase();
    if (this.instances[key]) {
      return this.instances[key];
    }

    const ChannelClass = registry[key];
    if (!ChannelClass) {
      throw new Error(`Unsupported notification channel type: ${channelKey}`);
    }

    this.instances[key] = new ChannelClass();
    logger.info(`[ChannelFactory] Instantiated notification channel adapter: ${key}`);
    return this.instances[key];
  }
}

module.exports = new ChannelFactory();
