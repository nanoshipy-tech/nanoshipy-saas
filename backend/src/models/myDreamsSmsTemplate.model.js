'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const MyDreamsSmsTemplate = sequelize.define('MyDreamsSmsTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  template_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  template_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  template_text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  variable_order: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
  },
  dlt_template_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'my_dreams_sms_templates',
  underscored: true,
  timestamps: true,
});

module.exports = MyDreamsSmsTemplate;
