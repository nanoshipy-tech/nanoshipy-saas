'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const TicketMessage = sequelize.define('TicketMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticket_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_type: {
    type: DataTypes.ENUM('tenant_user', 'platform_admin'),
    allowNull: false,
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_internal_note: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'ticket_messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TicketMessage;
