'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Wallet = require('./wallet.model');
const User = require('./user.model');

const RechargeOrder = sequelize.define('RechargeOrder', {
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
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Wallet,
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('amount');
      return val ? parseFloat(val) : 0;
    },
  },
  gateway: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'razorpay',
  },
  gateway_order_id: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  gateway_payment_id: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('created', 'pending', 'success', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'created',
  },
  initiated_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'recharge_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RechargeOrder;
