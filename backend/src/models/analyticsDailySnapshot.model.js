'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const AnalyticsDailySnapshot = sequelize.define('AnalyticsDailySnapshot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: '00000000-0000-0000-0000-000000000000',
  },
  snapshot_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  orders_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  shipments_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  delivered_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  ndr_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  rto_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  cod_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('cod_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  prepaid_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('prepaid_amount');
      return val ? parseFloat(val) : 0;
    },
  },
  shipping_spend: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('shipping_spend');
      return val ? parseFloat(val) : 0;
    },
  },
  revenue_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    get() {
      const val = this.getDataValue('revenue_amount');
      return val ? parseFloat(val) : null;
    },
  },
}, {
  tableName: 'analytics_daily_snapshots',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AnalyticsDailySnapshot;
