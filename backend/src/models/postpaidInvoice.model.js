'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const PostpaidInvoice = sequelize.define('PostpaidInvoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoice_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  billing_period_start: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  billing_period_end: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  subtotal_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('subtotal_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  tax_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('tax_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  total_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('total_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  paid_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    get() {
      const val = this.getDataValue('paid_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'),
    defaultValue: 'issued',
    allowNull: false,
  },
  pdf_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  line_items: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'postpaid_invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PostpaidInvoice;
