'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('whatsapp_bsp_configs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      bsp: { type: Sequelize.ENUM('interakt', 'gupshup', 'meta_cloud'), allowNull: false },
      api_key_encrypted: { type: Sequelize.TEXT, allowNull: false },
      webhook_verify_token: { type: Sequelize.STRING(255), allowNull: true },
      webhook_secret_encrypted: { type: Sequelize.TEXT, allowNull: true },
      phone_number_id: { type: Sequelize.STRING(100), allowNull: true },
      waba_id: { type: Sequelize.STRING(100), allowNull: true },
      display_phone_number: { type: Sequelize.STRING(20), allowNull: true },
      status: { type: Sequelize.ENUM('unconfigured', 'connected', 'error'), defaultValue: 'unconfigured', allowNull: false },
      last_tested_at: { type: Sequelize.DATE, allowNull: true },
      test_result: { type: Sequelize.JSONB, allowNull: true },
      message_quota_used: { type: Sequelize.INTEGER, allowNull: true },
      message_quota_limit: { type: Sequelize.INTEGER, allowNull: true },
      quota_reset_at: { type: Sequelize.DATE, allowNull: true },
      configured_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'platform_admins', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('whatsapp_bsp_configs');
  },
};
