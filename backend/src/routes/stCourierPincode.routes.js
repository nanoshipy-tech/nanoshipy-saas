'use strict';

const express = require('express');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const controller = require('../controllers/stCourierPincode.controller');

const router = express.Router();

router.use(isPlatformAdmin);

router.get('/', controller.listPincodes);
router.post('/', controller.addPincode);
router.post('/bulk', controller.bulkUploadPincodes);
router.delete('/:id', controller.deletePincode);
router.delete('/', controller.clearAllPincodes);
router.get('/check/:pincode', controller.checkServiceability);

module.exports = router;
