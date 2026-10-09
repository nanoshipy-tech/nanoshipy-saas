'use strict';

const express = require('express');
const router = express.Router();
const carrierMarginConfigController = require('../controllers/carrierMarginConfig.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

// All routes are platform admin only
router.get('/', isPlatformAdmin, canPlatform('admin.view'), carrierMarginConfigController.listConfigs);
router.post('/', isPlatformAdmin, canPlatform('platform_settings.manage'), carrierMarginConfigController.createConfig);
router.get('/:id', isPlatformAdmin, canPlatform('admin.view'), carrierMarginConfigController.getConfig);
router.put('/:id', isPlatformAdmin, canPlatform('platform_settings.manage'), carrierMarginConfigController.updateConfig);

module.exports = router;
