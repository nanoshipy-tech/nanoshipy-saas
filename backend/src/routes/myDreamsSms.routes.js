'use strict';

const express = require('express');
const router = express.Router();
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const controller = require('../controllers/myDreamsSms.controller');

// Admin protected endpoints
router.get('/settings', isPlatformAdmin, canPlatform('platform_settings.manage'), controller.getSettings);
router.put('/settings', isPlatformAdmin, canPlatform('platform_settings.manage'), controller.updateSettings);
router.post('/test', isPlatformAdmin, canPlatform('platform_settings.manage'), controller.testSms);
router.get('/logs', isPlatformAdmin, canPlatform('platform_settings.manage'), controller.getLogs);

// OTP endpoints
router.post('/otp/send', controller.sendOtp);
router.post('/otp/verify', controller.verifyOtp);

module.exports = router;
