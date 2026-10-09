'use strict';

const express = require('express');
const apiKeyController = require('../controllers/apiKey.controller');
const { createApiKeySchema } = require('../validators/apiKey.validator');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', can('apikey.view'), apiKeyController.listKeys);
router.post('/', can('apikey.manage'), validate(createApiKeySchema), apiKeyController.createKey);
router.put('/:id/revoke', can('apikey.manage'), apiKeyController.revokeKey);
router.get('/:id/usage', can('apikey.view'), apiKeyController.getUsageLogs);

module.exports = router;
