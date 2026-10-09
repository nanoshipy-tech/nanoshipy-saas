'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const CourierProvider = require('./courierProvider.model');

const ProviderHealthLog = sequelize.define('ProviderHealthLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  healthy: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  latency_ms: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  error_message: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  checked_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'provider_health_logs',
  timestamps: false, // Explicit checked_at column is used
});

module.exports = ProviderHealthLog;
