'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Banner = sequelize.define('Banner', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mode: {
    type: DataTypes.ENUM('default', 'image', 'text'),
    allowNull: false,
    defaultValue: 'text',
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  headline: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  subtext: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  badge: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  cta_text: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Apply & Book',
  },
  cta_link: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '/orders/new',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'banners',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['is_active'] },
  ],
});

module.exports = Banner;
