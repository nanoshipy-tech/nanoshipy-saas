const { Tenant, Role } = require('../models');

const findBySubdomain = async (subdomain) => {
  return Tenant.findOne({ where: { subdomain } });
};

const findById = async (id) => {
  return Tenant.findByPk(id);
};

const create = async (tenantData, transaction = null) => {
  return Tenant.create(tenantData, { transaction });
};

// Also put Role fetching here or in a separate role.repository
// Since we only need to fetch the owner role for signup, we'll include it here
const findGlobalRoleByName = async (name) => {
  return Role.findOne({
    where: {
      name,
      tenant_id: null,
      is_system_role: true,
    },
  });
};

const createTenantRole = async (roleData, transaction = null) => {
  return Role.create(roleData, { transaction });
};

// Clone global role permissions to the new tenant role
const cloneRolePermissions = async (sourceRoleId, targetRoleId, transaction = null) => {
  const sourceRole = await Role.findByPk(sourceRoleId, {
    include: 'permissions',
    transaction,
  });

  if (!sourceRole || !sourceRole.permissions) return;

  const permissionIds = sourceRole.permissions.map(p => p.id);
  const targetRole = await Role.findByPk(targetRoleId, { transaction });
  
  if (targetRole) {
    await targetRole.setPermissions(permissionIds, { transaction });
  }
};

module.exports = {
  findBySubdomain,
  findById,
  create,
  findGlobalRoleByName,
  createTenantRole,
  cloneRolePermissions,
};
