'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ExportJob = sequelize.define('ExportJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  requested_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  entity: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  filters: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  columns: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'queued',
    allowNull: false,
    validate: {
      isIn: [['queued', 'processing', 'completed', 'failed', 'expired']],
    },
  },
  total_rows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  file_key: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  file_size: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'export_jobs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['tenant_id', 'status', 'created_at'],
      name: 'idx_export_jobs_tenant_status_created',
    },
  ],
});

module.exports = ExportJob;
