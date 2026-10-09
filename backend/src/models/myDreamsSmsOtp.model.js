'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const MyDreamsSmsOtp = sequelize.define('MyDreamsSmsOtp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  otp_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  salt: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'my_dreams_sms_otps',
  underscored: true,
  timestamps: true,
});

module.exports = MyDreamsSmsOtp;
