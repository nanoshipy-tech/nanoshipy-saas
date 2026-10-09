'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ApiKeyUsageLog = sequelize.define('ApiKeyUsageLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  api_key_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  endpoint: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  response_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  tableName: 'api_key_usage_logs',
  timestamps: true,
  underscored: true,
});

module.exports = ApiKeyUsageLog;
