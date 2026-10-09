'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CourierCostRate = sequelize.define('CourierCostRate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  courier_display_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  service_mode: {
    type: DataTypes.ENUM('air', 'surface'),
    allowNull: false,
    defaultValue: 'surface',
  },
  base_weight_kg: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 0.50,
  },
  additional_weight_increment_kg: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 0.50,
  },
  zone: {
    type: DataTypes.ENUM('A', 'B', 'C', 'D', 'E'),
    allowNull: false,
  },
  base_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  additional_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  cod_flat_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  cod_percent_cost: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  effective_to: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName: 'courier_cost_rates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['courier_provider_id', 'service_mode', 'base_weight_kg', 'zone', 'effective_from'],
      name: 'unique_courier_cost_rate_slab',
    },
  ],
});

module.exports = CourierCostRate;
