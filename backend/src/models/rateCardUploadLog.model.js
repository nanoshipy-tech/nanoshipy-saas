'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const RateCardUploadLog = sequelize.define('RateCardUploadLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  import_mode: {
    type: DataTypes.ENUM('replace', 'append'),
    allowNull: false,
    defaultValue: 'append',
  },
  total_rows: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  success_rows: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  failed_rows: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  error_details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('success', 'partial_success', 'failed'),
    allowNull: false,
    defaultValue: 'success',
  },
}, {
  tableName: 'rate_card_upload_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RateCardUploadLog;
