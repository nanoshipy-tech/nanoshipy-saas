const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  module_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'permissions',
});

module.exports = Permission;
