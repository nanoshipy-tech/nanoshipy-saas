'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const PlatformAdmin = require('./platformAdmin.model');

const WhatsappTemplate = sequelize.define('WhatsappTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  category: {
    type: DataTypes.ENUM('utility', 'authentication', 'marketing'),
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'en',
  },
  header_text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  body_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  footer_text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  buttons: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  bsp_template_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  meta_approval_status: {
    type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'draft',
  },
  meta_rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
}, {
  tableName: 'whatsapp_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = WhatsappTemplate;
