const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const User = require('./user.model');

const CompanyDocument = sequelize.define('CompanyDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  document_type: {
    type: DataTypes.ENUM('pan', 'gst_certificate', 'address_proof', 'other'),
    allowNull: false,
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending',
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  tableName: 'company_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Associations
Tenant.hasMany(CompanyDocument, { foreignKey: 'tenant_id' });
CompanyDocument.belongsTo(Tenant, { foreignKey: 'tenant_id' });

User.hasMany(CompanyDocument, { foreignKey: 'uploaded_by' });
CompanyDocument.belongsTo(User, { foreignKey: 'uploaded_by' });

module.exports = CompanyDocument;
