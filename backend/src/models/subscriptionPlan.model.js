'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  price_monthly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('price_monthly');
      return val ? parseFloat(val) : 0;
    },
  },
  price_yearly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    get() {
      const val = this.getDataValue('price_yearly');
      return val ? parseFloat(val) : null;
    },
  },
  max_orders_per_month: {
    type: DataTypes.INTEGER,
    allowNull: true, // null = unlimited
  },
  max_users: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  max_pickup_addresses: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  courier_access_tier: {
    type: DataTypes.ENUM('basic', 'standard', 'all'),
    allowNull: false,
    defaultValue: 'basic',
  },
  support_tier: {
    type: DataTypes.ENUM('email', 'priority', 'dedicated'),
    allowNull: false,
    defaultValue: 'email',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'subscription_plans',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SubscriptionPlan;
