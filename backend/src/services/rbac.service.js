'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  PlatformRole,
  PlatformPermission,
  PlatformRolePermission,
  PlatformAdmin,
  User,
  Role,
  Permission,
  sequelize,
} = require('../models');
const {
  ADMIN_MODULES,
  USER_MODULES,
  getAllAdminPermissionKeys,
  getAllUserPermissionKeys,
} = require('../constants/rbacCatalog.constant');
const { PLATFORM_ROLES } = require('../constants/platformPermissions.constant');
const { getRedisClient } = require('../config/redis.config');

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

// -------------------------------------------------------------
// Cache Invalidation
// -------------------------------------------------------------

const invalidatePlatformAdminCache = async (roleName, roleId = null) => {
  const redis = getRedisClient();
  if (!redis) return;

  const where = {
    [Op.or]: [
      { role: roleName },
      ...(roleId ? [{ custom_role_id: roleId }] : []),
    ],
  };

  const admins = await PlatformAdmin.findAll({ where, attributes: ['id'] });
  if (admins.length > 0) {
    const pipeline = redis.pipeline();
    admins.forEach((a) => pipeline.del(`platform_perm:${a.id}`));
    await pipeline.exec();
  }
};

const invalidateUserPermissionsCache = async (roleId) => {
  const redis = getRedisClient();
  if (!redis) return;

  const users = await User.findAll({ where: { role_id: roleId }, attributes: ['id'] });
  if (users.length > 0) {
    const pipeline = redis.pipeline();
    users.forEach((u) => pipeline.del(`perm:${u.id}`));
    await pipeline.exec();
  }
};

// -------------------------------------------------------------
// Platform Roles (Admin Panel)
// -------------------------------------------------------------

const getPlatformRoles = async (query = {}) => {
  const { search } = query;
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { display_name: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const roles = await PlatformRole.findAll({
    where,
    order: [
      ['is_system', 'DESC'],
      ['created_at', 'ASC'],
    ],
  });

  // Query permissions and assigned admin counts for each role
  const results = await Promise.all(
    roles.map(async (role) => {
      const [rolePerms] = await sequelize.query(`
        SELECT p.key
        FROM platform_role_permissions rp
        JOIN platform_permissions p ON rp.permission_id = p.id
        WHERE rp.role = :roleName
      `, {
        replacements: { roleName: role.name },
      });

      const adminCount = await PlatformAdmin.count({
        where: {
          [Op.or]: [
            { custom_role_id: role.id },
            { role: role.name },
          ],
        },
      });

      return {
        id: role.id,
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        is_system: role.is_system,
        created_at: role.created_at,
        updated_at: role.updated_at,
        admin_count: adminCount,
        permission_keys: rolePerms.map((rp) => rp.key),
      };
    })
  );

  return results;
};

const getPlatformRoleById = async (id) => {
  const role = await PlatformRole.findByPk(id);
  if (!role) throw new NotFoundError('Platform role not found');

  const [rolePerms] = await sequelize.query(`
    SELECT p.key
    FROM platform_role_permissions rp
    JOIN platform_permissions p ON rp.permission_id = p.id
    WHERE rp.role = :roleName
  `, {
    replacements: { roleName: role.name },
  });

  const adminCount = await PlatformAdmin.count({
    where: {
      [Op.or]: [
        { custom_role_id: role.id },
        { role: role.name },
      ],
    },
  });

  return {
    id: role.id,
    name: role.name,
    display_name: role.display_name,
    description: role.description,
    is_system: role.is_system,
    created_at: role.created_at,
    updated_at: role.updated_at,
    admin_count: adminCount,
    permission_keys: rolePerms.map((rp) => rp.key),
  };
};

const getPlatformPermissionsCatalog = () => {
  return ADMIN_MODULES;
};

const createPlatformRole = async (data, adminUser) => {
  const { display_name, description, permission_keys = [] } = data;

  // Generate unique slug name
  let baseSlug = display_name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  if (!baseSlug) baseSlug = 'role';

  let roleName = baseSlug;
  let counter = 1;
  while (await PlatformRole.findOne({ where: { name: roleName } })) {
    roleName = `${baseSlug}_${counter++}`;
  }

  // Create role
  const role = await PlatformRole.create({
    id: uuidv4(),
    name: roleName,
    display_name,
    description: description || null,
    is_system: false,
    created_by: adminUser?.id || null,
  });

  // Assign permissions
  if (permission_keys.length > 0) {
    const perms = await PlatformPermission.findAll({
      where: { key: permission_keys },
    });

    for (const p of perms) {
      await sequelize.query(`
        INSERT INTO platform_role_permissions (role, permission_id, created_at, updated_at)
        VALUES (:roleName, :permId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
      `, {
        replacements: { roleName: role.name, permId: p.id },
      });
    }
  }

  return await getPlatformRoleById(role.id);
};

const updatePlatformRole = async (id, data, adminUser) => {
  const role = await PlatformRole.findByPk(id);
  if (!role) throw new NotFoundError('Platform role not found');

  if (role.is_system && role.name === 'super_admin') {
    throw new ForbiddenError('SUPER_ADMIN_IMMUTABLE', 'Super Admin master role permissions cannot be altered');
  }

  const { display_name, description, permission_keys } = data;

  if (display_name) role.display_name = display_name;
  if (description !== undefined) role.description = description;
  await role.save();

  if (Array.isArray(permission_keys)) {
    // Delete existing permissions for this role
    await sequelize.query(`
      DELETE FROM platform_role_permissions
      WHERE role = :roleName;
    `, {
      replacements: { roleName: role.name },
    });

    // Insert new permissions
    if (permission_keys.length > 0) {
      const perms = await PlatformPermission.findAll({
        where: { key: permission_keys },
      });

      for (const p of perms) {
        await sequelize.query(`
          INSERT INTO platform_role_permissions (role, permission_id, created_at, updated_at)
          VALUES (:roleName, :permId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING;
        `, {
          replacements: { roleName: role.name, permId: p.id },
        });
      }
    }

    // Invalidate Redis permissions cache for all affected admins
    await invalidatePlatformAdminCache(role.name, role.id);
  }

  return await getPlatformRoleById(role.id);
};

const deletePlatformRole = async (id, adminUser) => {
  const role = await PlatformRole.findByPk(id);
  if (!role) throw new NotFoundError('Platform role not found');

  if (role.is_system) {
    throw new ForbiddenError('SYSTEM_ROLE_PROTECTED', 'System platform roles cannot be deleted');
  }

  const adminCount = await PlatformAdmin.count({
    where: {
      [Op.or]: [
        { custom_role_id: role.id },
        { role: role.name },
      ],
    },
  });

  if (adminCount > 0) {
    throw new ConflictError(
      'ROLE_IN_USE',
      `Cannot delete role '${role.display_name}'. It is currently assigned to ${adminCount} administrator(s). Reassign them first.`
    );
  }

  // Clear role permissions
  await sequelize.query(`
    DELETE FROM platform_role_permissions
    WHERE role = :roleName;
  `, {
    replacements: { roleName: role.name },
  });

  await role.destroy();
  await invalidatePlatformAdminCache(role.name, role.id);

  return true;
};

// -------------------------------------------------------------
// Platform Admin My Permissions
// -------------------------------------------------------------

const getAdminPermissions = async (adminId) => {
  const redis = getRedisClient();
  const cacheKey = `platform_perm:${adminId}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const admin = await PlatformAdmin.findByPk(adminId);
  if (!admin) throw new NotFoundError('Platform admin not found');

  let permissions = [];

  if (admin.role === 'super_admin') {
    permissions = ['*'];
  } else if (admin.custom_role_id) {
    const [rolePerms] = await sequelize.query(`
      SELECT p.key
      FROM platform_role_permissions rp
      JOIN platform_roles pr ON pr.name = rp.role
      JOIN platform_permissions p ON rp.permission_id = p.id
      WHERE pr.id = :roleId
    `, {
      replacements: { roleId: admin.custom_role_id },
    });
    permissions = rolePerms.map((rp) => rp.key);
  } else {
    // Fallback to role name or legacy constant
    const [rolePerms] = await sequelize.query(`
      SELECT p.key
      FROM platform_role_permissions rp
      JOIN platform_permissions p ON rp.permission_id = p.id
      WHERE rp.role = :roleName
    `, {
      replacements: { roleName: admin.role },
    });
    permissions = rolePerms.map((rp) => rp.key);

    if (permissions.length === 0 && PLATFORM_ROLES[admin.role]) {
      permissions = PLATFORM_ROLES[admin.role];
    }
  }

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(permissions), 'EX', 300);
  }

  return permissions;
};

// -------------------------------------------------------------
// Tenant User RBAC Catalog & My Permissions
// -------------------------------------------------------------

const getUserPermissionsCatalog = () => {
  return USER_MODULES;
};

const getUserPermissions = async (userId) => {
  const redis = getRedisClient();
  const cacheKey = `perm:${userId}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        as: 'role',
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
      },
    ],
  });

  if (!user) throw new NotFoundError('User not found');

  let permissions = [];
  if (user.role) {
    if (user.role.name === 'owner' || user.role.name === 'admin') {
      permissions = ['*'];
    } else {
      permissions = (user.role.permissions || []).map((p) => p.key);
    }
  }

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(permissions), 'EX', 300);
  }

  return permissions;
};

module.exports = {
  getPlatformRoles,
  getPlatformRoleById,
  getPlatformPermissionsCatalog,
  createPlatformRole,
  updatePlatformRole,
  deletePlatformRole,
  getAdminPermissions,
  invalidatePlatformAdminCache,
  getUserPermissionsCatalog,
  getUserPermissions,
  invalidateUserPermissionsCache,
  ForbiddenError,
  ConflictError,
  NotFoundError,
};
