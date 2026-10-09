'use strict';

const express = require('express');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const stCourierAwbController = require('../controllers/stCourierAwb.controller');

const router = express.Router();

// Enforce Platform Admin authorization on all ST Courier AWB pool routes
router.use(isPlatformAdmin);

router.get('/', stCourierAwbController.listAwbs);
router.get('/stats', stCourierAwbController.getStats);
router.post('/upload', stCourierAwbController.uploadAwbs);
router.delete('/:id', stCourierAwbController.deleteAwb);

module.exports = router;
