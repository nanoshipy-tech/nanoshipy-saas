'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const StCourierAwbInventory = sequelize.define('StCourierAwbInventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  awb_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  origin_district: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'All',
  },
  payment_mode: {
    type: DataTypes.ENUM('prepaid', 'cod', 'both'),
    allowNull: false,
    defaultValue: 'both',
  },
  status: {
    type: DataTypes.ENUM('available', 'assigned', 'used', 'cancelled'),
    allowNull: false,
    defaultValue: 'available',
  },
  shipment_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  batch_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'st_courier_awb_inventories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  scopes: {
    available: {
      where: { status: 'available' },
    },
    assigned: {
      where: { status: 'assigned' },
    },
  },
});

module.exports = StCourierAwbInventory;
