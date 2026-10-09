'use strict';

const express = require('express');
const router = express.Router();
const platformSmtpController = require('../controllers/platformSmtp.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

router.get('/', platformSmtpController.getSmtpConfig);
router.put('/', platformSmtpController.updateSmtpConfig);
router.post('/test', platformSmtpController.sendTestEmail);

module.exports = router;
