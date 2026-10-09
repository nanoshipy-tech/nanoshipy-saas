const express = require('express');
const impersonationController = require('../controllers/impersonation.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const { validateImpersonate } = require('../validators/platformAuth.validator');

const router = express.Router();

router.post('/:tenantId', isPlatformAdmin, canPlatform('tenant.impersonate'), validateImpersonate, impersonationController.startImpersonation);
router.post('/:sessionId/end', isPlatformAdmin, impersonationController.endImpersonation);

module.exports = router;
