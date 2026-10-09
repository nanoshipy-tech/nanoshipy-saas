'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PaymentGateway = sequelize.define('PaymentGateway', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true, // razorpay, cashfree, payu, manual
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  mode: {
    type: DataTypes.ENUM('test', 'live'),
    defaultValue: 'test',
  },
  api_key: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  api_secret: {
    type: DataTypes.TEXT, // Encrypted at rest
    allowNull: true,
  },
  webhook_secret: {
    type: DataTypes.TEXT, // Encrypted at rest
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {
      min_recharge: 500,
      max_recharge: 100000,
      presets: [500, 1000, 2000, 5000],
      fee_percent: 0,
      auto_gst_invoice: true,
    },
  },
}, {
  tableName: 'payment_gateways',
  underscored: true,
  timestamps: true,
});

module.exports = PaymentGateway;
