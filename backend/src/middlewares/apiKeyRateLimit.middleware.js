'use strict';

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { getRedisClient } = require('../config/redis.config');

const rateLimitPerMinute = parseInt(process.env.API_KEY_RATE_LIMIT_PER_MINUTE, 10) || 120;

/**
 * Rate Limiter for API Key authenticated requests.
 * Uses the API Key's ID as the key to track limit, instead of IP address,
 * since a single tenant's backend might send all requests from a single IP.
 */
const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  store: process.env.USE_MOCK_REDIS === 'true' ? undefined : new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:apikey:',
  }),
  keyGenerator: (req) => {
    // If authenticated via API Key, use the key ID
    if (req.apiKey && req.apiKey.id) {
      return req.apiKey.id;
    }
    // Fallback to IP if not API Key auth (or if used before auth middleware incorrectly)
    return req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: `API rate limit exceeded. Limit is ${rateLimitPerMinute} requests per minute.`
    });
  },
});

module.exports = apiKeyRateLimiter;
