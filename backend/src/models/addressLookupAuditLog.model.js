'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const AddressLookupAuditLog = sequelize.define('AddressLookupAuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  pincode_searched: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  lookup_source: {
    type: DataTypes.ENUM('pincode_master', 'google', 'none'),
    defaultValue: 'none',
    allowNull: false,
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  error_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'address_lookup_audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['pincode_searched'],
    },
    {
      fields: ['created_at'],
    },
  ],
});

Tenant.hasMany(AddressLookupAuditLog, { foreignKey: 'tenant_id' });
AddressLookupAuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });

module.exports = AddressLookupAuditLog;
