'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Coupon = sequelize.define('Coupon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  benefit_type: {
    type: DataTypes.ENUM('bonus_credit', 'discount'),
    allowNull: false,
    defaultValue: 'bonus_credit',
  },
  discount_type: {
    type: DataTypes.ENUM('percentage', 'flat'),
    allowNull: false,
    defaultValue: 'percentage',
  },
  discount_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  min_recharge_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  max_discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  valid_from: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  usage_limit_total: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  usage_limit_per_user: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  used_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'coupons',
  underscored: true,
  timestamps: true,
});

module.exports = Coupon;
