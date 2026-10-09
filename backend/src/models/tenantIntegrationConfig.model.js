'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const PlatformIntegration = require('./platformIntegration.model');

const TenantIntegrationConfig = sequelize.define('TenantIntegrationConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  platform_integration_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: PlatformIntegration,
      key: 'id',
    },
  },
  credentials_encrypted: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  store_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  sync_orders_automatically: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  last_sync_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_sync_status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: true,
  },
}, {
  tableName: 'tenant_integration_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TenantIntegrationConfig;
