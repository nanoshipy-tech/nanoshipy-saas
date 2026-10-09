'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const { listActivityLog, exportActivityLog } = require('../controllers/activityLog.controller');

router.get('/', authenticate, can('settings.manage'), listActivityLog);
router.post('/export', authenticate, can('settings.manage'), exportActivityLog);

module.exports = router;
