'use strict';

const express = require('express');
const router = express.Router();
const platformIntegrationController = require('../controllers/platformIntegration.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

// Platform Admin Catalogue Management
router.get('/platform/catalogue', isPlatformAdmin, platformIntegrationController.listCatalogue);
router.put('/platform/catalogue/:id', isPlatformAdmin, platformIntegrationController.toggleGlobal);

// Tenant Store Integrations Configuration & Order Syncing
router.get('/storefront', authenticate, platformIntegrationController.getTenantConfigs);
router.post('/storefront', authenticate, platformIntegrationController.saveTenantConfig);
router.post('/storefront/:configId/sync', authenticate, platformIntegrationController.syncOrders);

module.exports = router;
