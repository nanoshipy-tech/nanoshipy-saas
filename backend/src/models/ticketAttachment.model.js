'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const TicketAttachment = sequelize.define('TicketAttachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticket_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ticket_message_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  file_size_bytes: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'ticket_attachments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TicketAttachment;
