'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const Invoice = sequelize.define('Invoice', {
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
  invoice_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  invoice_type: {
    type: DataTypes.ENUM('shipment', 'monthly_statement', 'manual'),
    allowNull: false,
  },
  reference_type: {
    type: DataTypes.ENUM('shipment', 'wallet_recharge', 'period'),
    allowNull: false,
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  billing_period_start: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  billing_period_end: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('subtotal');
      return val ? parseFloat(val) : 0;
    },
  },
  cgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('cgst_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  sgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('sgst_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  igst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('igst_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('total_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  status: {
    type: DataTypes.ENUM('generated', 'paid', 'void'),
    allowNull: false,
    defaultValue: 'generated',
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  pdf_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  billing_entity_gstin: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  place_of_supply: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  customer_gstin: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  customer_legal_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Invoice;
