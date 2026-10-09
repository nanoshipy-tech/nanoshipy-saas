'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const CourierProvider = require('./courierProvider.model');
const PickupAddress = require('./pickupAddress.model');
const User = require('./user.model');

const Manifest = sequelize.define('Manifest', {
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
  manifest_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  pickup_address_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PickupAddress,
      key: 'id',
    },
  },
  shipment_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  total_weight_kg: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0.000,
  },
  status: {
    type: DataTypes.ENUM('created', 'pickup_requested', 'pickup_completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'created',
  },
  pickup_scheduled_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  courier_pickup_token: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  tableName: 'manifests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Manifest;
