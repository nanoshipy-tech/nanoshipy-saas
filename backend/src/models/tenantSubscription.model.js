'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const SubscriptionPlan = require('./subscriptionPlan.model');

const TenantSubscription = sequelize.define('TenantSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  plan_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: SubscriptionPlan,
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('active', 'grace_period', 'suspended', 'cancelled'),
    allowNull: false,
    defaultValue: 'active',
  },
  billing_cycle: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    allowNull: false,
    defaultValue: 'monthly',
  },
  current_period_start: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  current_period_end: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  grace_period_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  auto_renew: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  pending_plan_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: SubscriptionPlan,
      key: 'id',
    },
  },
}, {
  tableName: 'tenant_subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TenantSubscription;
