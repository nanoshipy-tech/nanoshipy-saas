'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const PostpaidInvoice = require('./postpaidInvoice.model');
const PlatformAdmin = require('./platformAdmin.model');

const PostpaidPayment = sequelize.define('PostpaidPayment', {
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
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PostpaidInvoice,
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('amount');
      return val ? parseFloat(val) : 0;
    },
  },
  payment_method: {
    type: DataTypes.ENUM('razorpay', 'bank_transfer', 'cheque', 'manual_adjustment'),
    defaultValue: 'bank_transfer',
    allowNull: false,
  },
  payment_reference: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  recorded_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'postpaid_payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PostpaidPayment;
