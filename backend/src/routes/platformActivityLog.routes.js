'use strict';

const express = require('express');
const router = express.Router();
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const {
  listPlatformActivityLog,
  getTenantActivityLog,
  exportPlatformActivityLog,
} = require('../controllers/platformActivityLog.controller');

router.use(isPlatformAdmin);

// Note: /tenant/:tenantId must be registered before any generic :id routes
router.get('/tenant/:tenantId', canPlatform('admin.view'), getTenantActivityLog);
router.get('/', canPlatform('admin.view'), listPlatformActivityLog);
router.post('/export', canPlatform('admin.view'), exportPlatformActivityLog);

module.exports = router;
