'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WebhookIdempotency = sequelize.define('WebhookIdempotency', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  source: {
    type: DataTypes.STRING(50), // 'razorpay', 'shipway', 'delhivery', 'shopify', 'woocommerce'
    allowNull: false,
  },
  event_id: {
    type: DataTypes.STRING(255), // Razorpay payment_id, carrier tracking event ID, webhook UUID
    allowNull: false,
  },
  event_type: {
    type: DataTypes.STRING(100), // 'payment.captured', 'shipment.delivered', 'orders/create'
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('processing', 'processed', 'failed'),
    allowNull: false,
    defaultValue: 'processing',
  },
  payload_hash: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'webhook_idempotency',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['source', 'event_id'],
      name: 'unique_source_event_idx',
    },
  ],
});

module.exports = WebhookIdempotency;
