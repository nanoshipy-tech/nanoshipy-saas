'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Shipment = require('./shipment.model');

const ShipmentStatusHistory = sequelize.define('ShipmentStatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Shipment,
      key: 'id',
    },
  },
  old_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  new_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('manual', 'provider_webhook', 'system'),
    allowNull: false,
    defaultValue: 'system',
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'shipment_status_histories',
  timestamps: false, // Only created_at is utilized
});

module.exports = ShipmentStatusHistory;
