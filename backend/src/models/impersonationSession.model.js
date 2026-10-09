const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ImpersonationSession = sequelize.define('ImpersonationSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  platform_admin_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  target_tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  target_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'impersonation_sessions',
});

module.exports = ImpersonationSession;
