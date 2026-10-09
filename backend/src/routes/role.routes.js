'use strict';

const express = require('express');
const roleController = require('../controllers/role.controller');
const roleValidator = require('../validators/role.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

const router = express.Router();

router.use(authenticate);

// Permissions catalog for UI matrix
router.get('/permissions-catalog', can('role.view'), roleController.getPermissionsCatalog);

// Role CRUD
router.get('/', can('role.view'), roleController.getRoles);
router.get('/:id', can('role.view'), roleController.getRoleById);

router.post(
  '/',
  can('role.create'),
  roleValidator.validate(roleValidator.schemas.createRole),
  roleController.createRole
);

router.put(
  '/:id',
  can('role.update'),
  roleValidator.validate(roleValidator.schemas.updateRole),
  roleController.updateRole
);

router.delete('/:id', can('role.delete'), roleController.deleteRole);

module.exports = router;
