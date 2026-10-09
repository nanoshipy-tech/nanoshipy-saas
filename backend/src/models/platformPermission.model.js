const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformPermission = sequelize.define('PlatformPermission', {
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
  module_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'platform_permissions',
});

module.exports = PlatformPermission;
