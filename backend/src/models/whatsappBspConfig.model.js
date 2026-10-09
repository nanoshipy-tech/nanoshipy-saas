'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class WhatsappBspConfig extends Model {
    static associate(models) {
      WhatsappBspConfig.belongsTo(models.PlatformAdmin, { foreignKey: 'configured_by', as: 'configuredBy' });
    }
  }
  WhatsappBspConfig.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    bsp: { type: DataTypes.ENUM('interakt', 'gupshup', 'meta_cloud'), allowNull: false },
    api_key_encrypted: { type: DataTypes.TEXT, allowNull: false },
    webhook_verify_token: { type: DataTypes.STRING(255), allowNull: true },
    webhook_secret_encrypted: { type: DataTypes.TEXT, allowNull: true },
    phone_number_id: { type: DataTypes.STRING(100), allowNull: true },
    waba_id: { type: DataTypes.STRING(100), allowNull: true },
    display_phone_number: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.ENUM('unconfigured', 'connected', 'error'), defaultValue: 'unconfigured' },
    last_tested_at: { type: DataTypes.DATE, allowNull: true },
    test_result: { type: DataTypes.JSONB, allowNull: true },
    message_quota_used: { type: DataTypes.INTEGER, allowNull: true },
    message_quota_limit: { type: DataTypes.INTEGER, allowNull: true },
    quota_reset_at: { type: DataTypes.DATE, allowNull: true },
    configured_by: { type: DataTypes.UUID, allowNull: true },
  }, {
    sequelize, modelName: 'WhatsappBspConfig', tableName: 'whatsapp_bsp_configs', underscored: true, timestamps: true,
  });
  return WhatsappBspConfig;
};
