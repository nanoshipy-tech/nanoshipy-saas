'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');

const CodRemittance = sequelize.define('CodRemittance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  batch_reference: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  shipment_ids: {
    type: sequelize.getDialect() === 'postgres' ? DataTypes.ARRAY(DataTypes.UUID) : DataTypes.JSON,
    allowNull: false,
  },
  gross_cod_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  platform_fee_deducted: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  net_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  remittance_mode: {
    type: DataTypes.ENUM('wallet_credit', 'bank_payout'),
    allowNull: false,
    defaultValue: 'wallet_credit',
  },
  payout_reference: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'cod_remittances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CodRemittance;
