const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { getRedisClient } = require('../config/redis.config');

const createLimiter = (options) => {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return (req, res, next) => next();
  }

  // If mock redis is enabled, use standard express-rate-limit memory store
  if (process.env.USE_MOCK_REDIS === 'true') {
    return rateLimit({
      standardHeaders: true,
      legacyHeaders: false,
      ...options,
      validate: false,
    });
  }

  try {
    const RedisStore = require('rate-limit-redis').default;
    const client = getRedisClient();
    if (client && typeof client.call === 'function') {
      return rateLimit({
        store: new RedisStore({
          sendCommand: (...args) => client.call(...args),
        }),
        standardHeaders: true,
        legacyHeaders: false,
        ...options,
        validate: false,
      });
    }
  } catch (err) {
    // Fall back to memory store
  }

  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
    validate: false,
  });
};

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // Limit each IP to 30 requests per 15 minutes
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many login attempts, please try again later.' } },
  keyGenerator: (req) => `${req.ip}_${req.body.email || ''}`,
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many password reset requests, please try again later.' } },
  keyGenerator: (req) => `${req.ip}_${req.body.email || ''}`,
});

const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 1000, // Generous 1000 requests per 15 minutes per IP
  skip: (req) => req.path.includes('/platform/') || req.path.includes('/nav-counts'),
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later.' } },
});

const publicTrackingLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 30, // 30 requests per minute per IP / AWB
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many tracking requests. Please slow down and try again later.',
    },
  },
  keyGenerator: (req) => `${req.ip || 'ip'}_${req.params.awbNumber || req.query.awb || ''}`,
});

const shopifyManualConnectLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Max 10 attempts per 15 minutes to prevent token-guessing attacks
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many Shopify connection attempts. Please wait 15 minutes before trying again.',
    },
  },
  keyGenerator: (req) => `${req.ip}_${req.user?.tenant_id || req.body?.shop_domain || 'anon'}`,
});

module.exports = {
  createLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  globalLimiter,
  publicTrackingLimiter,
  shopifyManualConnectLimiter,
};

