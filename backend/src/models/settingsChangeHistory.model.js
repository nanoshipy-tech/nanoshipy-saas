'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SettingsChangeHistory = sequelize.define('SettingsChangeHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scope: {
    type: DataTypes.ENUM('tenant', 'platform'),
    allowNull: false,
  },
  scope_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  setting_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  old_value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  new_value: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  changed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'settings_change_history',
});

module.exports = SettingsChangeHistory;
