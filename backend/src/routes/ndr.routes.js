'use strict';

const express = require('express');
const router = express.Router();
const ndrController = require('../controllers/ndr.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { takeNdrActionSchema, bulkNdrActionSchema } = require('../validators/ndr.validator');

router.use(authenticate);

router.get('/', can('ndr.view'), ndrController.listNdrEvents);
router.get('/summary', can('ndr.view'), ndrController.getSummary);
router.get('/:id', can('ndr.view'), ndrController.getNdrEventDetail);
router.post('/bulk-action', can('ndr.action'), validate(bulkNdrActionSchema), ndrController.takeBulkAction);
router.post('/:id/action', can('ndr.action'), validate(takeNdrActionSchema), ndrController.takeAction);

module.exports = router;
