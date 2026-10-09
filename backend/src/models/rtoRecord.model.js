'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Shipment = require('./shipment.model');

const RtoRecord = sequelize.define('RtoRecord', {
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
    unique: true,
    references: {
      model: Shipment,
      key: 'id',
    },
  },
  initiated_reason: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  initiated_by: {
    type: DataTypes.ENUM('manual', 'auto_ndr_threshold', 'courier_initiated'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('rto_initiated', 'rto_in_transit', 'rto_delivered', 'rto_lost'),
    allowNull: false,
    defaultValue: 'rto_initiated',
  },
  rto_awb_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  expected_return_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  received_at_warehouse_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'rto_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RtoRecord;
