'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StorefrontSyncLog extends Model {
    static associate(models) {
      StorefrontSyncLog.belongsTo(models.StorefrontConnection, { foreignKey: 'connection_id', as: 'connection' });
    }
  }
  StorefrontSyncLog.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    connection_id: { type: DataTypes.UUID, allowNull: false },
    trigger: { type: DataTypes.ENUM('webhook', 'manual', 'scheduled'), allowNull: false },
    orders_fetched: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders_imported: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders_skipped: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders_failed: { type: DataTypes.INTEGER, defaultValue: 0 },
    error_details: { type: process.env.USE_SQLITE === 'true' ? DataTypes.JSON : DataTypes.JSONB, allowNull: true },
    started_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'StorefrontSyncLog', tableName: 'storefront_sync_logs', underscored: true, timestamps: true,
  });
  return StorefrontSyncLog;
};
