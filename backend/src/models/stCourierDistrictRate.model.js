'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const StCourierDistrictRate = sequelize.define('StCourierDistrictRate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  destination_district: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  first_500g_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 30.00,
  },
  additional_500g_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 15.00,
  },
  above_10kg_per_kg_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 25.00,
  },
  cod_first_500g_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 50.00,
  },
  cod_additional_500g_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 20.00,
  },
  cod_above_10kg_per_kg_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 35.00,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'st_courier_district_rates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['destination_district'],
    },
  ],
});

module.exports = StCourierDistrictRate;
