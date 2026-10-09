'use strict';

const express = require('express');
const router = express.Router();
const notificationPreferenceController = require('../controllers/notificationPreference.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { updatePreferencesSchema } = require('../validators/notificationPreference.validator');

router.get('/notification-preferences', authenticate, can('notification.view'), notificationPreferenceController.getPreferences);
router.put('/notification-preferences', authenticate, can('notification.manage'), validate(updatePreferencesSchema), notificationPreferenceController.updatePreferences);

module.exports = router;
