'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const PlatformAdmin = require('./platformAdmin.model');

const KycDocument = sequelize.define('KycDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  document_type: {
    type: DataTypes.ENUM('pan', 'gst_certificate', 'bank_cancelled_cheque', 'aadhaar_front', 'aadhaar_back', 'incorporation_certificate'),
    allowNull: false,
  },
  s3_object_key: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  verification_status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  uploaded_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: PlatformAdmin,
      key: 'id',
    },
  },
}, {
  tableName: 'kyc_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = KycDocument;
