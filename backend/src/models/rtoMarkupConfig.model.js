'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const RtoMarkupConfig = sequelize.define('RtoMarkupConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  surcharge_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 5.00,
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
  tableName: 'rto_markup_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RtoMarkupConfig;
