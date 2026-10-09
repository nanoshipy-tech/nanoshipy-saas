const express = require('express');
const permissionController = require('../controllers/permission.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', can('role.view'), permissionController.getPermissions);

module.exports = router;
