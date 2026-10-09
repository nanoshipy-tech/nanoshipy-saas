'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CouponUsage = sequelize.define('CouponUsage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  recharge_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  recharge_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  benefit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  benefit_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
}, {
  tableName: 'coupon_usages',
  underscored: true,
  timestamps: true,
});

module.exports = CouponUsage;
