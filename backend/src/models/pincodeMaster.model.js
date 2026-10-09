'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PincodeMaster = sequelize.define('PincodeMaster', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pincode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  is_serviceable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('seed', 'manual', 'api', 'bulk_upload'),
    defaultValue: 'seed',
    allowNull: false,
  },
}, {
  tableName: 'pincode_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['pincode'],
    },
    {
      fields: ['state'],
    },
  ],
});

module.exports = PincodeMaster;
