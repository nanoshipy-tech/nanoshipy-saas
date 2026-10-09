const { Permission } = require('../models');

const findAll = async () => {
  return await Permission.findAll({
    order: [['module_name', 'ASC'], ['key', 'ASC']],
  });
};

const findByKeys = async (keys) => {
  return await Permission.findAll({
    where: { key: keys },
  });
};

module.exports = {
  findAll,
  findByKeys,
};
