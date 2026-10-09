const { Role, Permission, User, sequelize } = require('../models');
const { getCurrentTenantId } = require('../middlewares/tenantScope.middleware');

const { Op } = require('sequelize');

const findAll = async (options = {}) => {
  const tenantId = getCurrentTenantId();
  const where = tenantId ? { [Op.or]: [{ tenant_id: tenantId }, { tenant_id: null }] } : {};
  return await Role.findAndCountAll({
    where: { ...where, ...options.where },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    distinct: true,
    ...options,
  });
};

const findById = async (id) => {
  const tenantId = getCurrentTenantId();
  return await Role.findOne({
    where: { id, tenant_id: tenantId },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  });
};

const create = async (data, permissionIds, transaction = null) => {
  const tenantId = getCurrentTenantId();
  
  const exec = async (t) => {
    const role = await Role.create({ ...data, tenant_id: tenantId }, { transaction: t });
    if (permissionIds && permissionIds.length > 0) {
      await role.setPermissions(permissionIds, { transaction: t });
    }
    return role;
  };

  if (transaction) return await exec(transaction);
  return await sequelize.transaction(exec);
};

const update = async (role, data, permissionIds, transaction = null) => {
  const exec = async (t) => {
    if (data) {
      await role.update(data, { transaction: t });
    }
    if (permissionIds) {
      await role.setPermissions(permissionIds, { transaction: t });
    }
    return role;
  };

  if (transaction) return await exec(transaction);
  return await sequelize.transaction(exec);
};

const remove = async (role, transaction = null) => {
  if (transaction) {
    await role.destroy({ transaction });
    return;
  }
  await role.destroy();
};

const countUsersWithRole = async (roleId) => {
  return await User.count({ where: { role_id: roleId } });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  countUsersWithRole,
};
