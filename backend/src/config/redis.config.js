const Redis = require('ioredis');
const RedisMock = require('ioredis-mock');
const config = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  if (process.env.USE_MOCK_REDIS === 'true') {
    logger.info('[Redis] Using mock Redis client for local development');
    redisClient = new RedisMock();
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('[Redis] Connection failed, switching to in-memory Redis mock.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('connect', () => logger.info('[Redis] Connected'));
    redisClient.on('error', (err) => {
      logger.warn(`[Redis] Connection warning (${err.message}). Using fallback in-memory client.`);
    });
  } catch (err) {
    logger.warn('[Redis] Falling back to mock Redis client');
    redisClient = new RedisMock();
  }

  return redisClient;
}

module.exports = { getRedisClient };
