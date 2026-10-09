const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  company_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  subdomain: {
    type: DataTypes.STRING(63),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'pending'),
    defaultValue: 'pending',
    allowNull: false,
  },
  plan_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  legal_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  gstin: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  business_type: {
    type: DataTypes.ENUM('individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'other'),
    allowNull: true,
  },
  support_email: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  support_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  profile_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  kyc_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'not_started',
    allowNull: false,
  },
  legal_business_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  pan_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  gst_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  gst_registered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  bank_account_number_encrypted: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bank_ifsc: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  bank_account_holder_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  bank_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  authorized_signatory_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  aadhaar_last4: {
    type: DataTypes.CHAR(4),
    allowNull: true,
  },
  kyc_rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  kyc_submitted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  kyc_approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  tracking_page_logo_s3_key: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  tracking_page_color: {
    type: DataTypes.STRING(7),
    allowNull: true,
  },
  auto_ndr_on_sandbox: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  kam_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  is_booking_office: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  tableName: 'tenants',
});

module.exports = Tenant;
