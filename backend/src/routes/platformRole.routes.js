'use strict';

const express = require('express');
const platformRoleController = require('../controllers/platformRole.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

const router = express.Router();

router.use(isPlatformAdmin);

// My permissions endpoint (available to any authenticated admin)
router.get('/my-permissions', platformRoleController.getMyPermissions);

// Permissions catalog for UI matrix
router.get('/permissions-catalog', canPlatform('admin.team.view'), platformRoleController.getPermissionsCatalog);

// CRUD
router.get('/', canPlatform('admin.team.view'), platformRoleController.getRoles);
router.get('/:id', canPlatform('admin.team.view'), platformRoleController.getRoleById);
router.post('/', canPlatform('admin.team.create'), platformRoleController.createRole);
router.put('/:id', canPlatform('admin.team.edit'), platformRoleController.updateRole);
router.delete('/:id', canPlatform('admin.team.delete'), platformRoleController.deleteRole);

module.exports = router;
