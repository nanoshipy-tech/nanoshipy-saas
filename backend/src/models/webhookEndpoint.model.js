'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WebhookEndpoint = sequelize.define('WebhookEndpoint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  events: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  consecutive_failures: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'webhook_endpoints',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['tenant_id', 'is_active'],
      name: 'idx_webhook_endpoints_tenant_active',
    },
  ],
});

// Backwards-compatibility synchronization with legacy tenant_webhooks
WebhookEndpoint.afterCreate(async (endpoint, options) => {
  try {
    const TenantWebhook = sequelize.models.TenantWebhook || require('./tenantWebhook.model');
    const User = sequelize.models.User || require('./user.model');
    if (TenantWebhook && User) {
      const user = (await User.findOne({ where: { tenant_id: endpoint.tenant_id } })) || (await User.findOne());
      if (user) {
        await TenantWebhook.findOrCreate({
          where: { id: endpoint.id },
          defaults: {
            id: endpoint.id,
            tenant_id: endpoint.tenant_id,
            target_url: endpoint.url,
            subscribed_events: endpoint.events || [],
            secret: endpoint.secret,
            is_active: endpoint.is_active,
            created_by: user.id,
          },
          transaction: options?.transaction,
        });
      }
    }
  } catch (err) {
    // Ignore synchronization error
  }
});

WebhookEndpoint.afterUpdate(async (endpoint, options) => {
  try {
    const TenantWebhook = sequelize.models.TenantWebhook || require('./tenantWebhook.model');
    if (TenantWebhook) {
      await TenantWebhook.update({
        target_url: endpoint.url,
        subscribed_events: endpoint.events,
        secret: endpoint.secret,
        is_active: endpoint.is_active,
      }, {
        where: { id: endpoint.id },
        transaction: options?.transaction,
      });
    }
  } catch (err) {
    // Ignore synchronization error
  }
});

WebhookEndpoint.afterDestroy(async (endpoint, options) => {
  try {
    const TenantWebhook = sequelize.models.TenantWebhook || require('./tenantWebhook.model');
    if (TenantWebhook) {
      await TenantWebhook.destroy({
        where: { id: endpoint.id },
        transaction: options?.transaction,
      });
    }
  } catch (err) {
    // Ignore synchronization error
  }
});

module.exports = WebhookEndpoint;

