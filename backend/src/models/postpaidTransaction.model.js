'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Shipment = require('./shipment.model');
const PostpaidInvoice = require('./postpaidInvoice.model');

const PostpaidTransaction = sequelize.define('PostpaidTransaction', {
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
  shipment_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Shipment,
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
  type: {
    type: DataTypes.ENUM('debit', 'credit', 'adjustment', 'reserve', 'release'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reference_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'postpaid_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PostpaidTransaction;
