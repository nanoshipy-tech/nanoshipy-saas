'use strict';

const express = require('express');
const router = express.Router();
const platformWebhookLogController = require('../controllers/platformWebhookLog.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

router.get('/', platformWebhookLogController.listWebhookLogs);

module.exports = router;
