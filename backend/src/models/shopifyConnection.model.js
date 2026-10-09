'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const ShopifyConnection = sequelize.define('ShopifyConnection', {
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
  shop_domain: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  connection_method: {
    type: DataTypes.ENUM('oauth', 'manual'),
    allowNull: false,
    defaultValue: 'manual',
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'AES-256 encrypted access token at rest',
  },
  scopes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  webhook_registered: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('connected', 'disconnected', 'token_invalid'),
    allowNull: false,
    defaultValue: 'connected',
  },
  webhook_secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Custom app webhook signing secret for Option B HMAC validation',
  },
  connected_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'shopify_connections',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'shopify_connections_tenant_id_idx',
      fields: ['tenant_id'],
    },
    {
      name: 'shopify_connections_tenant_shop_unique',
      unique: true,
      fields: ['tenant_id', 'shop_domain'],
    },
    {
      name: 'shopify_connections_shop_domain_idx',
      fields: ['shop_domain'],
    },
  ],
});

module.exports = ShopifyConnection;
