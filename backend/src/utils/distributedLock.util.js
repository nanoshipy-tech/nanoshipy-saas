'use strict';

const { getRedisClient } = require('../config/redis.config');
const logger = require('./logger');

const fallbackLocks = new Map();

/**
 * Attempt to acquire an atomic distributed lock.
 * @param {string} key - Lock identifier
 * @param {number} [ttlMs=15000] - Lock expiration in milliseconds
 * @returns {Promise<boolean>} True if lock was acquired, false otherwise
 */
async function acquireLock(key, ttlMs = 15000) {
  try {
    const client = getRedisClient();
    if (client && typeof client.set === 'function') {
      const acquired = await client.set(key, 'locked', 'PX', ttlMs, 'NX');
      return !!acquired;
    }
  } catch (err) {
    logger.warn(`[DistributedLock] Redis lock acquisition failed, falling back to local memory: ${err.message}`);
  }

  const now = Date.now();
  const exp = fallbackLocks.get(key);
  if (exp && exp > now) {
    return false;
  }
  fallbackLocks.set(key, now + ttlMs);
  return true;
}

/**
 * Release an acquired distributed lock.
 * @param {string} key - Lock identifier
 * @returns {Promise<void>}
 */
async function releaseLock(key) {
  try {
    const client = getRedisClient();
    if (client && typeof client.del === 'function') {
      await client.del(key);
    }
  } catch (err) {
    logger.warn(`[DistributedLock] Redis lock release failed: ${err.message}`);
  }

  fallbackLocks.delete(key);
}

module.exports = {
  acquireLock,
  releaseLock,
};
