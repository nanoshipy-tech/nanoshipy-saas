const roleRepo = require('../repositories/role.repository');
const permissionRepo = require('../repositories/permission.repository');
const auditService = require('./audit.service');
const { getRedisClient } = require('../config/redis.config');
const { RESERVED_PERMISSIONS } = require('../constants/permissions.constant');

class ForbiddenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
  }
}

class ConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ConflictError';
    this.code = code;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

const invalidateUserPermissionsCache = async (roleId) => {
  // To completely clear cache for users of this role, we would need to know their IDs,
  // or we can use a key pattern. For now, since users fetch their perms based on role,
  // we invalidate any user tied to this role. 
  // Given we map perm:{user_id}, we need to query users by roleId.
  const { User } = require('../models');
  const users = await User.findAll({ where: { role_id: roleId }, attributes: ['id'] });
  
  const redis = getRedisClient();
  if (redis && users.length > 0) {
    const pipeline = redis.pipeline();
    users.forEach(u => pipeline.del(`perm:${u.id}`));
    await pipeline.exec();
  }
};

const { USER_MODULES } = require('../constants/rbacCatalog.constant');

const getRoles = async (query = {}, req = null) => {
  const { page = 1, limit = 50, search } = query;
  const offset = (page - 1) * limit;
  const tenantId = req?.user?.tenant_id || req?.tenant?.id;
  const { Op } = require('sequelize');

  const where = {};
  if (tenantId) {
    where[Op.or] = [{ tenant_id: tenantId }, { tenant_id: null }];
  }
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }

  const options = { where, offset, limit: parseInt(limit, 10) };
  return await roleRepo.findAll(options);
};

const getRoleById = async (id, req = null) => {
  const role = await roleRepo.findById(id);
  if (!role) throw new NotFoundError('Role not found');
  const tenantId = req?.user?.tenant_id || req?.tenant?.id;
  if (tenantId && role.tenant_id && role.tenant_id !== tenantId) {
    throw new NotFoundError('Role not found');
  }
  return role;
};

const validatePrivilegeEscalation = (requestedKeys, currentUserPerms = [], userRole = '') => {
  if (
    ['owner', 'admin', 'super_admin'].includes((userRole || '').toLowerCase()) ||
    (currentUserPerms && currentUserPerms.includes('*'))
  ) {
    return;
  }
  for (const key of requestedKeys) {
    if (!currentUserPerms.includes(key)) {
      throw new ForbiddenError('PERMISSION_ESCALATION', `You cannot grant permissions you do not hold yourself: ${key}`);
    }
  }
};

const createRole = async (data, req) => {
  const { name, description, permission_keys } = data;
  
  // Guard
  validatePrivilegeEscalation(permission_keys, req.user?.permissions, req.user?.role);

  const dbPerms = await permissionRepo.findByKeys(permission_keys);
  const permIds = dbPerms.map(p => p.id);

  const role = await roleRepo.create({ name, description, is_editable: true }, permIds);

  if (req.user?.tenant_id) {
    await auditService.log(
      req.user.tenant_id,
      req.user.id,
      'role_created',
      { role_id: role.id, name, permission_keys_after: permission_keys },
      req
    );
  }

  return await roleRepo.findById(role.id);
};

const updateRole = async (id, data, req) => {
  const { name, description, permission_keys } = data;
  
  const role = await getRoleById(id, req);
  if (!role.is_editable) {
    throw new ForbiddenError('SYSTEM_ROLE', 'System roles cannot be modified');
  }

  // Guard
  validatePrivilegeEscalation(permission_keys, req.user?.permissions, req.user?.role);

  const dbPerms = await permissionRepo.findByKeys(permission_keys);
  const permIds = dbPerms.map(p => p.id);
  
  const permission_keys_before = role.permissions.map(p => p.key);

  await roleRepo.update(role, { name, description }, permIds);
  await invalidateUserPermissionsCache(role.id);

  if (req.user?.tenant_id) {
    await auditService.log(
      req.user.tenant_id,
      req.user.id,
      'role_updated',
      { role_id: role.id, permission_keys_before, permission_keys_after: permission_keys },
      req
    );
  }

  return await roleRepo.findById(role.id);
};

const deleteRole = async (id, req) => {
  const role = await getRoleById(id, req);
  if (!role.is_editable) {
    throw new ForbiddenError('SYSTEM_ROLE', 'System roles cannot be deleted');
  }

  const userCount = await roleRepo.countUsersWithRole(id);
  if (userCount > 0) {
    throw new ConflictError('ROLE_IN_USE', 'Cannot delete a role assigned to active users');
  }

  await roleRepo.remove(role);
  
  if (req.user?.tenant_id) {
    await auditService.log(
      req.user.tenant_id,
      req.user.id,
      'role_deleted',
      { role_id: role.id, name: role.name },
      req
    );
  }
  
  return true;
};

const getPermissionsCatalog = () => {
  return USER_MODULES;
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getPermissionsCatalog,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  invalidateUserPermissionsCache,
};
