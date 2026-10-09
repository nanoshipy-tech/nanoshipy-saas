'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const MarkupConfig = sequelize.define('MarkupConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scope: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'global', // 'global', 'seller', 'booking_office', 'courier', 'courier_zone', 'zone'
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  booking_office_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  zone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  markup_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 30.00,
  },
  flat_markup_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
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
  tableName: 'markup_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['scope', 'seller_id', 'booking_office_id', 'courier_provider_id', 'zone', 'effective_from'],
    },
  ],
});

module.exports = MarkupConfig;
