'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Shipment = require('./shipment.model');
const PlatformAdmin = require('./platformAdmin.model');

const WeightDiscrepancyDispute = sequelize.define('WeightDiscrepancyDispute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  seller_id: {
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
  awb: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  declared_weight_kg: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: false,
  },
  courier_weight_kg: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: false,
  },
  disputed_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('open', 'under_review', 'accepted', 'rejected', 'reversed'),
    allowNull: false,
    defaultValue: 'open',
  },
  seller_note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  admin_note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  evidence_s3_keys: {
    type: sequelize.getDialect() === 'postgres' ? DataTypes.ARRAY(DataTypes.STRING(500)) : DataTypes.JSON,
    allowNull: true,
  },
  raised_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
}, {
  tableName: 'weight_discrepancy_disputes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = WeightDiscrepancyDispute;
