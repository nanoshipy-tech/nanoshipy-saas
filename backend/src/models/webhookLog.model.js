'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const CourierProvider = require('./courierProvider.model');

const WebhookLog = sequelize.define('WebhookLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  headers: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  signature_valid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  processed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  processing_error: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  received_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'webhook_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = WebhookLog;
