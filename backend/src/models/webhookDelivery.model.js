'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WebhookDelivery = sequelize.define('WebhookDelivery', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  endpoint_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  tenant_webhook_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  event: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  event_key: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  response_status_code: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  response_body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending',
  },
  next_retry_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'webhook_deliveries',
  timestamps: true,
  underscored: true,
});

module.exports = WebhookDelivery;
