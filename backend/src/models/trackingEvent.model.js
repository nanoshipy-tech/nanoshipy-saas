'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Shipment = require('./shipment.model');

const TrackingEvent = sequelize.define('TrackingEvent', {
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
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  raw_status: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  event_timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('webhook', 'poll', 'manual'),
    allowNull: false,
  },
  ingested_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'tracking_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = TrackingEvent;
