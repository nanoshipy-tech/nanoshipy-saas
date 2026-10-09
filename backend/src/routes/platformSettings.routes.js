'use strict';

const express = require('express');
const router = express.Router();
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const { updatePlatformSettingSchema } = require('../validators/settings.validator');
const {
  getPlatformSettings,
  updatePlatformSetting,
  getLocationSettings,
  updateLocationSettings,
  testGoogleMapsConnection,
  getWhatsAppSettings,
  updateWhatsAppSettings,
  testWhatsAppMessage,
  getSmsSettings,
  updateSmsSettings,
  testSms,
  getGoogleAuthSettings,
  updateGoogleAuthSettings,
} = require('../controllers/platformSettings.controller');

router.use(isPlatformAdmin);

router.get('/google-auth', canPlatform('platform_settings.manage'), getGoogleAuthSettings);
router.put('/google-auth', canPlatform('platform_settings.manage'), updateGoogleAuthSettings);

router.get('/whatsapp', canPlatform('platform_settings.manage'), getWhatsAppSettings);
router.put('/whatsapp', canPlatform('platform_settings.manage'), updateWhatsAppSettings);
router.post('/whatsapp/test', canPlatform('platform_settings.manage'), testWhatsAppMessage);

router.get('/sms', canPlatform('platform_settings.manage'), getSmsSettings);
router.put('/sms', canPlatform('platform_settings.manage'), updateSmsSettings);
router.post('/sms/test', canPlatform('platform_settings.manage'), testSms);

router.get('/location', canPlatform('platform_settings.manage'), getLocationSettings);
router.put('/location', canPlatform('platform_settings.manage'), updateLocationSettings);
router.post('/location/test-maps', canPlatform('platform_settings.manage'), testGoogleMapsConnection);
router.get('/', canPlatform('platform_settings.manage'), getPlatformSettings);
router.put('/:key', canPlatform('platform_settings.manage'), validate(updatePlatformSettingSchema), updatePlatformSetting);

module.exports = router;
