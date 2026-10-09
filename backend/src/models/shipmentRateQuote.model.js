'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Order = require('./order.model');
const CourierProvider = require('./courierProvider.model');

const ShipmentRateQuote = sequelize.define('ShipmentRateQuote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Order,
      key: 'id',
    },
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  service_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  cod_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  estimated_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quoted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'shipment_rate_quotes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ShipmentRateQuote;
