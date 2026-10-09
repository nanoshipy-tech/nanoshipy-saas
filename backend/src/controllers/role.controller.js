'use strict';

const roleService = require('../services/role.service');
const { success, error } = require('../utils/apiResponse');

const getRoles = async (req, res, next) => {
  try {
    const result = await roleService.getRoles(req.query, req);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const result = await roleService.getRoleById(req.params.id, req);
    return success(res, result);
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return error(res, { code: 'NOT_FOUND', message: err.message }, 404);
    }
    next(err);
  }
};

const getPermissionsCatalog = async (req, res, next) => {
  try {
    const catalog = roleService.getPermissionsCatalog();
    return success(res, catalog);
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const result = await roleService.createRole(req.body, req);
    return success(res, result, 201);
  } catch (err) {
    if (err.name === 'ForbiddenError') {
      return error(res, { code: err.code || 'FORBIDDEN', message: err.message }, 403);
    }
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const result = await roleService.updateRole(req.params.id, req.body, req);
    return success(res, result);
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
    await roleService.deleteRole(req.params.id, req);
    return success(res, { message: 'Role deleted successfully' });
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

module.exports = {
  getRoles,
  getRoleById,
  getPermissionsCatalog,
  createRole,
  updateRole,
  deleteRole,
};
