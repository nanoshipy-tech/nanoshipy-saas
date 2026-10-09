'use strict';

const rbacService = require('../services/rbac.service');
const { success, error } = require('../utils/apiResponse');

const getRoles = async (req, res, next) => {
  try {
    const roles = await rbacService.getPlatformRoles(req.query);
    return success(res, roles);
  } catch (err) {
    next(err);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const role = await rbacService.getPlatformRoleById(req.params.id);
    return success(res, role);
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return error(res, { code: 'NOT_FOUND', message: err.message }, 404);
    }
    next(err);
  }
};

const getPermissionsCatalog = async (req, res, next) => {
  try {
    const catalog = rbacService.getPlatformPermissionsCatalog();
    return success(res, catalog);
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const role = await rbacService.createPlatformRole(req.body, req.platformAdmin || req.user);
    return success(res, role, 201);
  } catch (err) {
    if (err.name === 'ForbiddenError') {
      return error(res, { code: err.code || 'FORBIDDEN', message: err.message }, 403);
    }
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const role = await rbacService.updatePlatformRole(req.params.id, req.body, req.platformAdmin || req.user);
    return success(res, role);
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return error(res, { code: 'NOT_FOUND', message: err.message }, 404);
    }
    if (err.name === 'ForbiddenError') {
      return error(res, { code: err.code || 'FORBIDDEN', message: err.message }, 403);
    }
    next(err);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    await rbacService.deletePlatformRole(req.params.id, req.platformAdmin || req.user);
    return success(res, { message: 'Platform role deleted successfully' });
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return error(res, { code: 'NOT_FOUND', message: err.message }, 404);
    }
    if (err.name === 'ConflictError') {
      return error(res, { code: err.code || 'CONFLICT', message: err.message }, 409);
    }
    if (err.name === 'ForbiddenError') {
      return error(res, { code: err.code || 'FORBIDDEN', message: err.message }, 403);
    }
    next(err);
  }
};

const getMyPermissions = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin?.id || req.user?.id;
    if (!adminId) {
      return error(res, { code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }
    const permissions = await rbacService.getAdminPermissions(adminId);
    return success(res, { permissions });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRoles,
  getRoleById,
  getPermissionsCatalog,
  createRole,
  updateRole,
  deleteRole,
  getMyPermissions,
};
