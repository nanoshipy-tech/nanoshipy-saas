'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  key_prefix: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },
  key_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  scopes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_used_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sandbox_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'api_keys',
  timestamps: true,
  underscored: true,
});

module.exports = ApiKey;
