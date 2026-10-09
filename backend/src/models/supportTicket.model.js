'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SupportTicket = sequelize.define('SupportTicket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ticket_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('billing', 'technical', 'shipment_issue', 'account', 'other'),
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'waiting_on_tenant', 'resolved', 'closed'),
    allowNull: false,
    defaultValue: 'open',
  },
  related_shipment_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  related_order_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  assigned_to: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  first_response_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sla_due_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sla_breached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  tableName: 'support_tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SupportTicket;
