'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const SubscriptionPlan = require('./subscriptionPlan.model');

const PlanChangeHistory = sequelize.define('PlanChangeHistory', {
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
  old_plan_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: SubscriptionPlan,
      key: 'id',
    },
  },
  new_plan_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: SubscriptionPlan,
      key: 'id',
    },
  },
  change_type: {
    type: DataTypes.ENUM('upgrade', 'downgrade', 'renewal', 'initial'),
    allowNull: false,
  },
  changed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'plan_change_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Immutable logging table
});

module.exports = PlanChangeHistory;
