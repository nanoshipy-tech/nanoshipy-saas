'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const RateCard = sequelize.define('RateCard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  courier_display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  courier_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
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
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  additional_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
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
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'rate_cards',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['courier_provider_id', 'service_mode', 'base_weight_kg', 'zone', 'effective_from'],
      name: 'unique_rate_card_effective_slab',
    },
  ],
});

module.exports = RateCard;
