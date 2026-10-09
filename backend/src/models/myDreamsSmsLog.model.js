'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const MyDreamsSmsLog = sequelize.define('MyDreamsSmsLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone_masked: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  template_key: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  order_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status_event: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false, // 'sent', 'failed', 'skipped', 'simulated'
  },
  request_url_masked: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  vendor_response: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'my_dreams_sms_logs',
  underscored: true,
  timestamps: true,
});

module.exports = MyDreamsSmsLog;
