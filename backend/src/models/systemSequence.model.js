'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SystemSequence = sequelize.define('SystemSequence', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sequence_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  last_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'system_sequences',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SystemSequence;
