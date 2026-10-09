const { PlatformAdmin } = require('../models');
const { Op } = require('sequelize');

const findByEmail = async (email) => {
  if (!email) return null;
  const clean = String(email).trim().toLowerCase();
  return PlatformAdmin.findOne({
    where: {
      [Op.or]: [
        { email: clean },
        { email: String(email).trim() }
      ]
    }
  });
};

const findById = async (id) => {
  return PlatformAdmin.findByPk(id);
};

const create = async (adminData) => {
  return PlatformAdmin.create(adminData);
};

const update = async (id, updateData) => {
  await PlatformAdmin.update(updateData, { where: { id } });
  return findById(id);
};

module.exports = {
  findByEmail,
  findById,
  create,
  update,
};
