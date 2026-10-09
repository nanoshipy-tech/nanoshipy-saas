'use strict';

const express = require('express');
const router = express.Router();
const rtoController = require('../controllers/rto.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateRtoStatusSchema } = require('../validators/ndr.validator');

router.use(authenticate);

router.get('/', can('rto.view'), rtoController.listRtoRecords);
router.get('/:id', can('rto.view'), rtoController.getRtoRecordDetail);
router.put('/:id/status', can('rto.action'), validate(updateRtoStatusSchema), rtoController.updateStatus);

module.exports = router;
