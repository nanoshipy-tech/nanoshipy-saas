'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const CourierProvider = require('./courierProvider.model');
const Tenant = require('./tenant.model');
const PlatformAdmin = require('./platformAdmin.model');

const CarrierMarginConfig = sequelize.define('CarrierMarginConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  carrier_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  seller_tier: {
    type: DataTypes.ENUM('standard', 'growth', 'enterprise', 'all'),
    allowNull: false,
    defaultValue: 'all',
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  margin_type: {
    type: DataTypes.ENUM('flat', 'percentage'),
    allowNull: false,
    defaultValue: 'flat',
  },
  margin_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('margin_value');
      return val ? parseFloat(val) : 0;
    },
  },
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  effective_until: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
}, {
  tableName: 'carrier_margin_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CarrierMarginConfig;
