'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const PlatformAdmin = require('./platformAdmin.model');

const WalletAdjustment = sequelize.define('WalletAdjustment', {
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
  admin_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('amount');
      return val ? parseFloat(val) : 0;
    },
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  idempotency_key: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  new_balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    get() {
      const val = this.getDataValue('new_balance');
      return val ? parseFloat(val) : 0;
    },
  },
}, {
  tableName: 'wallet_adjustments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = WalletAdjustment;
