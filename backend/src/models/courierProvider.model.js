'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const PlatformAdmin = require('./platformAdmin.model');

const CourierProvider = sequelize.define('CourierProvider', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  credentials_encrypted: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  config: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  supports_cod: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  supports_prepaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  max_weight_kg: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  service_types: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  sandbox_mode: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  circuit_breaker_state: {
    type: DataTypes.ENUM('closed', 'open', 'half_open'),
    allowNull: false,
    defaultValue: 'closed',
  },
  circuit_breaker_opened_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  consecutive_failures: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
}, {
  tableName: 'courier_providers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  defaultScope: {
    attributes: { exclude: ['credentials_encrypted'] }
  },
  scopes: {
    withCredentials: {
      attributes: {}
    }
  }
});

module.exports = CourierProvider;
