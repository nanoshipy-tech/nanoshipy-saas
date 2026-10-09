const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformRolePermission = sequelize.define('PlatformRolePermission', {
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true,
  },
  permission_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
}, {
  tableName: 'platform_role_permissions',
});

module.exports = PlatformRolePermission;
