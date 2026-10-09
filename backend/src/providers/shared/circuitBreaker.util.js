'use strict';

const { getRedisClient } = require('../../config/redis.config');
const { CourierProvider, PlatformAdmin } = require('../../models');
const platformAuditService = require('../../services/platformAudit.service');
const emailService = require('../../services/email.service');
const logger = require('../../utils/logger');
const { CircuitBreakerOpenError } = require('../errors');

const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5;
const CIRCUIT_BREAKER_WINDOW_SECONDS = parseInt(process.env.CIRCUIT_BREAKER_WINDOW_SECONDS, 10) || 300;
const CIRCUIT_BREAKER_COOLDOWN_SECONDS = parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_SECONDS, 10) || 120;

/**
 * Increment failure counter and open circuit if threshold is reached.
 *
 * @param {string} providerId
 */
const recordFailure = async (providerId) => {
  try {
    const redis = getRedisClient();
    const failuresKey = `circuit:${providerId}:failures`;
    const stateKey = `circuit:${providerId}:state`;
    const openedAtKey = `circuit:${providerId}:opened_at`;

    // Increment failures count
    const failures = await redis.incr(failuresKey);
    if (failures === 1) {
      await redis.expire(failuresKey, CIRCUIT_BREAKER_WINDOW_SECONDS);
    }

    logger.warn(`Circuit Breaker: Provider ${providerId} recorded failure ${failures}/${CIRCUIT_BREAKER_THRESHOLD}`);

    // If failures hit the threshold, open the circuit
    if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
      const currentState = await redis.get(stateKey) || 'closed';
      
      if (currentState !== 'open') {
        logger.error(`Circuit Breaker: Threshold reached! Opening circuit for provider ${providerId}`);
        
        const now = new Date();
        
        // Update Redis state with TTL matching cooldown
        await redis.set(stateKey, 'open', 'EX', CIRCUIT_BREAKER_COOLDOWN_SECONDS);
        await redis.set(openedAtKey, now.toISOString(), 'EX', CIRCUIT_BREAKER_COOLDOWN_SECONDS);

        // Update database status (using unscoped or withCredentials scope to allow edit of otherwise hidden attributes)
        const provider = await CourierProvider.scope('withCredentials').findByPk(providerId);
        if (provider) {
          await provider.update({
            circuit_breaker_state: 'open',
            circuit_breaker_opened_at: now,
            consecutive_failures: failures,
          });

          // Fetch active platform admins to send email alert and attribute audit log
          const admins = await PlatformAdmin.findAll({ where: { status: 'active' } });
          const systemAdminId = admins && admins.length > 0 ? admins[0].id : provider.created_by;

          if (systemAdminId) {
            await platformAuditService.log({
              platform_admin_id: systemAdminId,
              action: 'circuit_breaker_opened',
              entity_type: 'courier_provider',
              entity_id: providerId,
              metadata: { consecutive_failures: failures, opened_at: now.toISOString(), automated: true },
            });
          }
          for (const admin of admins) {
            await emailService.sendEmail({
              to: admin.email,
              subject: `[ALERT] Courier Circuit Breaker OPENED: ${provider.display_name}`,
              templateName: 'circuit-breaker-alert',
              data: {
                providerName: provider.display_name,
                providerKey: provider.provider_key,
                providerId: provider.id,
                consecutiveFailures: failures.toString(),
                openedAt: now.toLocaleString(),
              },
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error('Circuit Breaker: Failed to record failure:', err);
  }
};

/**
 * Reset failure counter and close circuit.
 *
 * @param {string} providerId
 */
const recordSuccess = async (providerId) => {
  try {
    const redis = getRedisClient();
    const failuresKey = `circuit:${providerId}:failures`;
    const stateKey = `circuit:${providerId}:state`;
    const openedAtKey = `circuit:${providerId}:opened_at`;

    const currentState = await redis.get(stateKey) || 'closed';

    // Clear count in Redis
    await redis.del(failuresKey);
    await redis.del(stateKey);
    await redis.del(openedAtKey);

    if (currentState !== 'closed') {
      logger.info(`Circuit Breaker: Closing circuit for provider ${providerId}`);

      const provider = await CourierProvider.scope('withCredentials').findByPk(providerId);
      if (provider) {
        await provider.update({
          circuit_breaker_state: 'closed',
          circuit_breaker_opened_at: null,
          consecutive_failures: 0,
        });

        // Write platform audit log
        const defaultAdmin = await PlatformAdmin.findOne({ where: { status: 'active' } });
        const systemAdminId = defaultAdmin ? defaultAdmin.id : provider.created_by;

        if (systemAdminId) {
          await platformAuditService.log({
            platform_admin_id: systemAdminId,
            action: 'circuit_breaker_closed',
            entity_type: 'courier_provider',
            entity_id: providerId,
            metadata: { consecutive_failures: 0 },
          });
        }
      }
    }
  } catch (err) {
    logger.error('Circuit Breaker: Failed to record success:', err);
  }
};

/**
 * Check circuit breaker status. If open, check if cooldown has completed to transition to half_open.
 * If open and within cooldown, throws CircuitBreakerOpenError.
 *
 * @param {string} providerId
 * @param {string} providerKey
 * @throws {CircuitBreakerOpenError}
 */
const checkBreakerState = async (providerId, providerKey) => {
  const redis = getRedisClient();
  const stateKey = `circuit:${providerId}:state`;

  let state = await redis.get(stateKey);

  // If Redis does not have the state, check the database fallback
  if (!state) {
    const provider = await CourierProvider.findByPk(providerId);
    if (provider && provider.circuit_breaker_state === 'open') {
      const openedAt = new Date(provider.circuit_breaker_opened_at).getTime();
      const elapsed = (Date.now() - openedAt) / 1000;
      
      if (elapsed < CIRCUIT_BREAKER_COOLDOWN_SECONDS) {
        state = 'open';
        // Restore in Redis
        const remaining = Math.round(CIRCUIT_BREAKER_COOLDOWN_SECONDS - elapsed);
        await redis.set(stateKey, 'open', 'EX', remaining);
      } else {
        // Cooldown finished, transition to half_open
        state = 'half_open';
        await provider.update({ circuit_breaker_state: 'half_open' });
      }
    } else {
      state = 'closed';
    }
  }

  if (state === 'open') {
    throw new CircuitBreakerOpenError(providerKey);
  }

  return state;
};

/**
 * Manually force reset a circuit breaker to closed state.
 *
 * @param {string} providerId
 */
const resetBreaker = async (providerId) => {
  await recordSuccess(providerId);
};

/**
 * Get current circuit breaker status from Redis and DB.
 *
 * @param {string} providerId
 * @returns {Promise<object>} { state, failures }
 */
const getBreakerStatus = async (providerId) => {
  const redis = getRedisClient();
  const stateKey = `circuit:${providerId}:state`;
  const failuresKey = `circuit:${providerId}:failures`;

  let state = await redis.get(stateKey);
  const failures = await redis.get(failuresKey) || 0;

  if (!state) {
    const provider = await CourierProvider.findByPk(providerId);
    state = provider ? provider.circuit_breaker_state : 'closed';
  }

  return {
    state,
    failures: parseInt(failures, 10),
  };
};

module.exports = {
  recordFailure,
  recordSuccess,
  checkBreakerState,
  resetBreaker,
  getBreakerStatus,
};
