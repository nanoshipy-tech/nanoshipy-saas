'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CostRateSnapshot = sequelize.define('CostRateSnapshot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipment_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  sell_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  margin_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  margin_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  markup_percent_applied: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 30.00,
  },
  captured_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'cost_rate_snapshots',
  timestamps: false,
  indexes: [
    { fields: ['courier_provider_id', 'captured_at'] },
    { fields: ['shipment_id'] },
  ],
});

module.exports = CostRateSnapshot;
