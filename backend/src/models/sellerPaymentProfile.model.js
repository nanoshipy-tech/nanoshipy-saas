'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const SellerPaymentProfile = sequelize.define('SellerPaymentProfile', {
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
  payment_mode: {
    type: DataTypes.ENUM('prepaid', 'postpaid'),
    defaultValue: 'prepaid',
    allowNull: false,
  },
  credit_limit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('credit_limit');
      return val ? parseFloat(val) : 0;
    },
  },
  outstanding_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('outstanding_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  reserved_credit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('reserved_credit');
      return val ? parseFloat(val) : 0;
    },
  },
  available_credit: {
    type: DataTypes.VIRTUAL,
    get() {
      const limit = parseFloat(this.getDataValue('credit_limit') || 0);
      const outstanding = parseFloat(this.getDataValue('outstanding_amount') || 0);
      const reserved = parseFloat(this.getDataValue('reserved_credit') || 0);
      return Math.max(0, Math.round((limit - outstanding - reserved) * 100) / 100);
    },
  },
  billing_cycle: {
    type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
    defaultValue: 'weekly',
    allowNull: false,
  },
  payment_terms_days: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'grace_period'),
    defaultValue: 'active',
    allowNull: false,
  },
  grace_period_days: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    allowNull: false,
  },
  auto_debit_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  settlement_bank_account: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'seller_payment_profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SellerPaymentProfile;
