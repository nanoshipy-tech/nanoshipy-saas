const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const PlatformAuditLog = sequelize.define('PlatformAuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  platform_admin_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  target_tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  entity_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  entity_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'platform_audit_logs',
});

module.exports = PlatformAuditLog;
