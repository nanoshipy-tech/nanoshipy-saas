'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateTenantSettingsSchema } = require('../validators/settings.validator');
const { getSettings, updateSettings, updateProfile, updatePassword } = require('../controllers/tenantSettings.controller');

router.get('/', authenticate, can('settings.manage'), getSettings);
router.put('/', authenticate, can('settings.manage'), validate(updateTenantSettingsSchema), updateSettings);
router.put('/profile', authenticate, updateProfile);
router.put('/security/password', authenticate, updatePassword);

module.exports = router;
