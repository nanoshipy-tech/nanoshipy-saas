'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const StCourierServiceablePincode = sequelize.define('StCourierServiceablePincode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: false,
    unique: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  hub_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(50),
    defaultValue: 'Tamil Nadu',
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'st_courier_serviceable_pincodes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['pincode'],
    },
    {
      fields: ['district'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = StCourierServiceablePincode;
