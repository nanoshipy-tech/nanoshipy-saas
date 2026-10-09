'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const NdrEvent = require('./ndrEvent.model');
const User = require('./user.model');

const NdrAction = sequelize.define('NdrAction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ndr_event_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: NdrEvent,
      key: 'id',
    },
  },
  action_type: {
    type: DataTypes.ENUM('reattempt', 'update_address', 'update_phone', 'mark_rto', 'call_customer', 'no_action', 'escalate_courier'),
    allowNull: false,
  },
  notes: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  updated_address_line1: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  updated_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  performed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  tableName: 'ndr_actions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = NdrAction;
