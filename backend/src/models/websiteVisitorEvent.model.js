'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WebsiteVisitorEvent = sequelize.define('WebsiteVisitorEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'page_view', // 'page_view' | 'track_search' | 'cta_click' | 'signup_click'
  },
  path: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  referrer: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  session_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  visitor_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  screen_resolution: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  utm_source: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  utm_medium: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  utm_campaign: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'website_visitor_events',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['event_type'] },
    { fields: ['path'] },
    { fields: ['created_at'] },
    { fields: ['session_id'] },
  ],
});

module.exports = WebsiteVisitorEvent;
