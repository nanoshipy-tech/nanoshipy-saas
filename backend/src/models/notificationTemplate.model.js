'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const NotificationTemplate = sequelize.define('NotificationTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  event_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  channel: {
    type: DataTypes.ENUM('email', 'sms', 'whatsapp', 'inapp'),
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  body_template: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  meta_template_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'notification_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = NotificationTemplate;
