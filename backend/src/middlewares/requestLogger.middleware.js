const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  
  const start = Date.now();
  
  // Log request
  logger.info(`[REQ] ${req.method} ${req.url}`, {
    requestId: req.id,
    ip: req.ip,
  });

  // Intercept response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[RES] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      tenantId: req.user?.tenant_id,
      userId: req.user?.id,
    });
  });

  next();
};

module.exports = requestLogger;
