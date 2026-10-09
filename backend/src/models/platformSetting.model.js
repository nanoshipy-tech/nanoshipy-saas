'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformSetting = sequelize.define('PlatformSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  setting_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  setting_value: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  value_type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
    allowNull: false,
    defaultValue: 'string',
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'platform_settings',
});

module.exports = PlatformSetting;
