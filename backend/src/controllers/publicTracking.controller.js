'use strict';

const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const trackingService = require('../services/tracking.service');

/**
 * GET /api/v1/track/:awbNumber
 * Public tracking endpoint — returns timeline without PII.
 * No authentication required.
 */
const getPublicTracking = async (req, res, next) => {
  try {
    const { awbNumber } = req.params;

    const tracking = await trackingService.getPublicTracking(awbNumber);

    if (!tracking) {
      throw new NotFoundError('Tracking information not found for this AWB number');
    }

    return success(res, tracking);
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('[PublicTrackingController Error]:', { error: err.message, stack: err.stack });
    next(err);
  }
};

module.exports = { getPublicTracking };
