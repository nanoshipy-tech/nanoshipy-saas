const cron = require('node-cron');
const refreshTokenRepo = require('../repositories/refreshToken.repository');
const logger = require('../utils/logger');

// Run every day at 3:00 AM
const cleanupJob = cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('[Job] Starting expired token cleanup...');
    const deletedCount = await refreshTokenRepo.deleteExpired();
    logger.info(`[Job] Cleanup complete. Deleted ${deletedCount} expired refresh tokens.`);
  } catch (error) {
    logger.error('[Job] Failed to clean up tokens:', { error: error.message });
  }
}, {
  scheduled: false // Don't start automatically on require
});

module.exports = cleanupJob;
