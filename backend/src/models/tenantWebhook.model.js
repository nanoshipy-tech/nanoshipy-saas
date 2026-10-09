'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const TenantWebhook = sequelize.define('TenantWebhook', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  target_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  subscribed_events: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_delivery_status: {
    type: DataTypes.ENUM('success', 'failed', 'pending'),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'tenant_webhooks',
  timestamps: true,
  underscored: true,
});

module.exports = TenantWebhook;
