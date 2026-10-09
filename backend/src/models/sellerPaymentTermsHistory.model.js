'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const PlatformAdmin = require('./platformAdmin.model');

const SellerPaymentTermsHistory = sequelize.define('SellerPaymentTermsHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  changed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
  previous_mode: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  new_mode: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  previous_credit_limit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    get() {
      const val = this.getDataValue('previous_credit_limit');
      return val !== null && val !== undefined ? parseFloat(val) : null;
    },
  },
  new_credit_limit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    get() {
      const val = this.getDataValue('new_credit_limit');
      return val !== null && val !== undefined ? parseFloat(val) : null;
    },
  },
  previous_billing_cycle: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  new_billing_cycle: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'seller_payment_terms_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SellerPaymentTermsHistory;
