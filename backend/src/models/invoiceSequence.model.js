'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InvoiceSequence = sequelize.define('InvoiceSequence', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  financial_year: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  series_key: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  last_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'invoice_sequences',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = InvoiceSequence;
