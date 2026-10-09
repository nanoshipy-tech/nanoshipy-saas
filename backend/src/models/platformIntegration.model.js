'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformIntegration = sequelize.define('PlatformIntegration', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  integration_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
}, {
  tableName: 'platform_integrations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PlatformIntegration;
