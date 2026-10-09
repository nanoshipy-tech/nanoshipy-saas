'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const BlogPost = sequelize.define('BlogPost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  excerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  featured_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Logistics',
  },
  tags: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
  author_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'NanoShipy Editorial',
  },
  author_avatar: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  reading_time: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: '4 min read',
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    allowNull: false,
    defaultValue: 'published',
  },
  meta_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  meta_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  views_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  h1_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  faq_items: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
}, {
  tableName: 'blog_posts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['status', 'published_at'] },
    { fields: ['category'] },
  ],
});

module.exports = BlogPost;
