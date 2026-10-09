'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const Wallet = sequelize.define('Wallet', {
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
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('balance');
      return val ? parseFloat(val) : 0;
    },
  },
  held_balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('held_balance');
      return val ? parseFloat(val) : 0;
    },
  },
  credit_limit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('credit_limit');
      return val ? parseFloat(val) : 0;
    },
  },
  available_balance: {
    type: DataTypes.VIRTUAL,
    get() {
      const balance = parseFloat(this.getDataValue('balance') || 0);
      const creditLimit = parseFloat(this.getDataValue('credit_limit') || 0);
      const held = parseFloat(this.getDataValue('held_balance') || 0);
      return Math.round((balance + creditLimit - held) * 100) / 100;
    },
  },
  low_balance_threshold: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 500.00,
    get() {
      const val = this.getDataValue('low_balance_threshold');
      return val ? parseFloat(val) : 500;
    },
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR',
  },
}, {
  tableName: 'wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Wallet;
