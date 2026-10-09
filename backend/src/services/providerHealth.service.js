'use strict';

const courierProviderRepository = require('../repositories/courierProvider.repository');
const providerCredentialService = require('./providerCredential.service');
const ProviderFactory = require('../providers/ProviderFactory');
const { ProviderHealthLog } = require('../models');
const config = require('../config/env');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

/**
 * Execute a health check check on a courier provider and persist logs.
 *
 * @param {string} providerId
 * @returns {Promise<object>} Result containing { healthy, latency_ms }
 */
const runHealthCheck = async (providerId) => {
  const provider = await courierProviderRepository.findById(providerId, true);
  if (!provider) {
    throw new NotFoundError('Courier provider not found');
  }

  const credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
  const adapter = await ProviderFactory.getAdapter(provider.provider_key, credentials, provider.config || {}, provider.id);

  const startTime = Date.now();
  let healthy = false;
  let latencyMs = 0;
  let errorMessage = null;

  try {
    const response = await adapter.healthCheck();
    latencyMs = Date.now() - startTime;
    if (response.success && response.data && response.data.healthy) {
      healthy = true;
    } else {
      errorMessage = response.error ? response.error.message : 'Adapter reported unhealthy';
    }
  } catch (err) {
    latencyMs = Date.now() - startTime;
    errorMessage = err.message;
  }

  // Create health log entry
  await ProviderHealthLog.create({
    courier_provider_id: providerId,
    healthy,
    latency_ms: latencyMs,
    error_message: errorMessage ? errorMessage.slice(0, 255) : null,
    checked_at: new Date(),
  });

  // Track in circuit breaker
  const circuitBreaker = require('../providers/shared/circuitBreaker.util');
  if (healthy) {
    await circuitBreaker.recordSuccess(providerId);
  } else {
    await circuitBreaker.recordFailure(providerId);
  }

  // Check for consecutive failures
  await checkConsecutiveFailures(providerId);

  return { healthy, latencyMs, errorMessage };
};

/**
 * Assess health of provider, falling back to instant check if cached log is stale.
 *
 * @param {string} providerId
 * @returns {Promise<boolean>}
 */
const isHealthy = async (providerId) => {
  const provider = await courierProviderRepository.findById(providerId);
  if (!provider || provider.circuit_breaker_state === 'open') {
    return false;
  }

  const latestLog = await ProviderHealthLog.findOne({
    where: { courier_provider_id: providerId },
    order: [['checked_at', 'DESC']],
  });

  const staleLimitMs = config.provider.healthCheckStaleMinutes * 60 * 1000;
  
  if (!latestLog || (new Date() - new Date(latestLog.checked_at)) > staleLimitMs) {
    // Stale or missing, trigger run
    logger.info(`Health check for provider ${providerId} is stale or missing. Executing new health check.`);
    const result = await runHealthCheck(providerId);
    return result.healthy;
  }

  return latestLog.healthy;
};

/**
 * Count consecutive failed checks and alert when threshold is hit.
 *
 * @param {string} providerId
 */
const checkConsecutiveFailures = async (providerId) => {
  const recentLogs = await ProviderHealthLog.findAll({
    where: { courier_provider_id: providerId },
    order: [['checked_at', 'DESC']],
    limit: 3,
  });

  if (recentLogs.length >= 3 && recentLogs.every(log => !log.healthy)) {
    // Stub alert implementation
    logger.error(`[ALERT] Courier provider with ID ${providerId} has failed health checks 3 times consecutively!`);
    // In future modules, this triggers platform email notifications or webhooks
  }
};

module.exports = {
  runHealthCheck,
  isHealthy,
  checkConsecutiveFailures,
};
