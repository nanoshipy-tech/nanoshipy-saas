'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CodMarkupConfig = sequelize.define('CodMarkupConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  flat_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 40.00,
  },
  percent_charge: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 2.50,
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
  tableName: 'cod_markup_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CodMarkupConfig;
