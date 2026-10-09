'use strict';

const logger = require('../../utils/logger');

const PROVIDER_RETRY_MAX_ATTEMPTS = parseInt(process.env.PROVIDER_RETRY_MAX_ATTEMPTS, 10) || 3;
const PROVIDER_RETRY_BASE_DELAY_MS = parseInt(process.env.PROVIDER_RETRY_BASE_DELAY_MS, 10) || 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determine if an error is transient (5xx, timeout, or network connection failure).
 *
 * @param {Error} err
 * @returns {boolean}
 */
const isTransientError = (err) => {
  if (err.isAxiosError) {
    if (!err.response) {
      return true;
    }
    const status = err.response.status;
    if (status >= 500 && status <= 599) {
      return true;
    }
    return false;
  }
  
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.message?.includes('Network Error')) {
    return true;
  }
  return false;
};

/**
 * Executes a function with retries and exponential backoff.
 *
 * @param {Function} fn - Async function to execute
 * @param {Array} args - Arguments to pass to fn
 * @returns {Promise<any>}
 */
const executeWithRetry = async (fn, args = []) => {
  let attempt = 0;
  
  while (true) {
    try {
      return await fn(...args);
    } catch (err) {
      attempt++;
      const transient = isTransientError(err);
      
      if (attempt >= PROVIDER_RETRY_MAX_ATTEMPTS || !transient) {
        if (!transient) {
          logger.warn(`Non-transient error encountered. Skipping retries: ${err.message}`);
        } else {
          logger.error(`Max retry attempts (${PROVIDER_RETRY_MAX_ATTEMPTS}) reached for transient error: ${err.message}`);
        }
        throw err;
      }
      
      const backoffDelay = PROVIDER_RETRY_BASE_DELAY_MS * Math.pow(3, attempt - 1);
      logger.warn(`Transient error encountered: ${err.message}. Retrying attempt ${attempt + 1}/${PROVIDER_RETRY_MAX_ATTEMPTS} after ${backoffDelay}ms...`);
      await delay(backoffDelay);
    }
  }
};

module.exports = {
  executeWithRetry,
  isTransientError,
};
