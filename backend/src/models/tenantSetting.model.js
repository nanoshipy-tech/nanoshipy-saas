'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const TenantSetting = sequelize.define('TenantSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  invoice_prefix_override: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  ndr_auto_rto_threshold_override: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  default_pickup_address_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  low_balance_threshold_override: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'tenant_settings',
});

module.exports = TenantSetting;
