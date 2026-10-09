const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformAdmin = sequelize.define('PlatformAdmin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'platform_staff', 'finance', 'support_agent', 'key_account_manager'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    allowNull: false,
    defaultValue: 'active',
  },
  two_factor_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  two_factor_secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  token_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  custom_role_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'platform_admins',
});

module.exports = PlatformAdmin;
