'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const NotificationLog = sequelize.define('NotificationLog', {
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
  event_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  channel: {
    type: DataTypes.ENUM('email', 'sms', 'whatsapp', 'inapp'),
    allowNull: false,
  },
  recipient: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('queued', 'sent', 'delivered', 'failed'),
    allowNull: false,
    defaultValue: 'queued',
  },
  provider_response: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'notification_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Immutable logging table
});

module.exports = NotificationLog;
