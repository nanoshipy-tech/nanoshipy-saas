'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Invoice = require('./invoice.model');

const InvoiceLineItem = sequelize.define('InvoiceLineItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Invoice,
      key: 'id',
    },
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  hsn_sac_code: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('unit_price');
      return val ? parseFloat(val) : 0;
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
}, {
  tableName: 'invoice_line_items',
  timestamps: false, // Standard static table
});

module.exports = InvoiceLineItem;
