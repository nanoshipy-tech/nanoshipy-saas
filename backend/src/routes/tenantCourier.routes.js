'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const tenantCourierController = require('../controllers/tenantCourier.controller');

const router = express.Router();

router.use(authenticate);
router.use(can('courier.view'));

router.get('/', tenantCourierController.listAvailable);

module.exports = router;
