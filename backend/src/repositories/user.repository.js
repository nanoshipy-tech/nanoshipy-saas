const { User, Role, Tenant } = require('../models');
const { Op } = require('sequelize');

const findByEmailAndTenant = async (email, tenant_id, includePassword = false) => {
  const scope = includePassword ? 'withPassword' : 'defaultScope';
  const clean = String(email || '').trim().toLowerCase();
  return User.scope(scope).findOne({
    where: {
      tenant_id,
      [Op.or]: [
        { email: clean },
        { email: String(email || '').trim() }
      ]
    },
    include: [
      { model: Role, as: 'role', attributes: ['id', 'name', 'is_system_role'] },
      { model: Tenant, as: 'tenant', attributes: ['id', 'status', 'subdomain'] },
    ],
  });
};

const findById = async (id, includePassword = false, includeSecret = false) => {
  const scopes = [];
  if (includePassword) scopes.push('withPassword');
  if (includeSecret) scopes.push('withSecret');
  
  const query = scopes.length ? User.scope(...scopes) : User;
  
  return query.findByPk(id, {
    include: [
      { model: Role, as: 'role', attributes: ['id', 'name', 'is_system_role'] },
      { model: Tenant, as: 'tenant', attributes: ['id', 'status', 'subdomain'] },
    ],
  });
};

const create = async (userData, transaction = null) => {
  return User.create(userData, { transaction });
};

const update = async (id, updateData, transaction = null) => {
  return User.update(updateData, {
    where: { id },
    transaction,
  });
};

module.exports = {
  findByEmailAndTenant,
  findById,
  create,
  update,
};
