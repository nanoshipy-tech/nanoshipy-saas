'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Shipment = require('./shipment.model');
const TrackingEvent = require('./trackingEvent.model');

const NdrEvent = sequelize.define('NdrEvent', {
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
    allowNull: false,
    references: {
      model: Shipment,
      key: 'id',
    },
  },
  tracking_event_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: TrackingEvent,
      key: 'id',
    },
  },
  reason_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  raw_reason: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM('open', 'action_taken', 'resolved_delivered', 'resolved_rto'),
    allowNull: false,
    defaultValue: 'open',
  },
  sla_due_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'ndr_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = NdrEvent;
