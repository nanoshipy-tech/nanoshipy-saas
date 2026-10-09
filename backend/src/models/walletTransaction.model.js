'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Wallet = require('./wallet.model');
const Tenant = require('./tenant.model');
const User = require('./user.model');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Wallet,
      key: 'id',
    },
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit'),
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
  balance_after: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('balance_after');
      return val ? parseFloat(val) : 0;
    },
  },
  reference_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  invoice_s3_key: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  performed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  gateway_payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  razorpay_payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Immutable ledger - append only
});

module.exports = WalletTransaction;
