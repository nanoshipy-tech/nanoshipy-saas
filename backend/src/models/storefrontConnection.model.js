'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StorefrontConnection extends Model {
    static associate(models) {
      StorefrontConnection.belongsTo(models.Tenant, { foreignKey: 'seller_id', as: 'seller' });
      StorefrontConnection.hasMany(models.StorefrontSyncLog, { foreignKey: 'connection_id', as: 'syncLogs' });
    }
  }
  StorefrontConnection.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    seller_id: { type: DataTypes.UUID, allowNull: false },
    platform: { type: DataTypes.ENUM('shopify', 'woocommerce', 'magento', 'amazon', 'flipkart', 'custom'), allowNull: false },
    store_name: { type: DataTypes.STRING(255), allowNull: false },
    store_url: { type: DataTypes.STRING(500), allowNull: false },
    access_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
    api_secret_encrypted: { type: DataTypes.TEXT, allowNull: true },
    webhook_secret: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM('connected', 'disconnected', 'error', 'pending_auth'), defaultValue: 'pending_auth' },
    last_synced_at: { type: DataTypes.DATE, allowNull: true },
    sync_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    auto_create_shipment: { type: DataTypes.BOOLEAN, defaultValue: false },
    order_status_filter: { type: process.env.USE_SQLITE === 'true' ? DataTypes.JSON : DataTypes.ARRAY(DataTypes.TEXT), defaultValue: ['pending', 'processing'] },
    error_message: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'StorefrontConnection', tableName: 'storefront_connections', underscored: true, timestamps: true,
  });
  return StorefrontConnection;
};
