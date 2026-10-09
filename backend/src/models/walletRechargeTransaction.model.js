'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WalletRechargeTransaction = sequelize.define('WalletRechargeTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  gateway_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  gateway_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'razorpay',
  },
  gateway_order_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  gateway_payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  gateway_signature: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  fee_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  gst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('initiated', 'success', 'failed', 'refunded'),
    defaultValue: 'initiated',
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  wallet_transaction_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reconciled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reconciled_by: {
    type: DataTypes.STRING(100),
    allowNull: true, // 'webhook' | 'client_verify' | 'admin_reconcile' | 'job'
  },
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  coupon_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  coupon_benefit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  coupon_benefit_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
}, {
  tableName: 'wallet_recharge_transactions',
  underscored: true,
  timestamps: true,
});

module.exports = WalletRechargeTransaction;
