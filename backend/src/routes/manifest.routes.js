'use strict';

const express = require('express');
const manifestController = require('../controllers/manifest.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', manifestController.createManifest);
router.get('/', manifestController.listManifests);
router.get('/:id', manifestController.getManifest);

module.exports = router;
