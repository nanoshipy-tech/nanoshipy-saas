'use strict';

const express = require('express');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const controller = require('../controllers/stCourierDistrictRate.controller');

const router = express.Router();

router.use(isPlatformAdmin);

router.get('/', controller.list);
router.post('/', controller.upsert);
router.delete('/:id', controller.remove);

module.exports = router;
