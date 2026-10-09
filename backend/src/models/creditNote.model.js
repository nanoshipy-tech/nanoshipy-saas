'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Invoice = require('./invoice.model');

const CreditNote = sequelize.define('CreditNote', {
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
  original_invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Invoice,
      key: 'id',
    },
  },
  credit_note_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  reason: {
    type: DataTypes.STRING(255),
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
  reference_type: {
    type: DataTypes.ENUM('shipment_cancelled', 'shipment_rto', 'manual'),
    allowNull: false,
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  pdf_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'credit_notes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Immutable financial document
});

module.exports = CreditNote;
