'use strict';

const express = require('express');
const router = express.Router();
const publicTrackingController = require('../controllers/publicTracking.controller');
const { publicTrackingLimiter } = require('../middlewares/rateLimiter.middleware');

router.get('/:awbNumber', publicTrackingLimiter, publicTrackingController.getPublicTracking);

module.exports = router;

