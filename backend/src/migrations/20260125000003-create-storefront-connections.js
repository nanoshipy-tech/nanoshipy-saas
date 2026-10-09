'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storefront_connections', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      seller_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      platform: { type: Sequelize.ENUM('shopify', 'woocommerce', 'magento', 'amazon', 'flipkart', 'custom'), allowNull: false },
      store_name: { type: Sequelize.STRING(255), allowNull: false },
      store_url: { type: Sequelize.STRING(500), allowNull: false },
      access_token_encrypted: { type: Sequelize.TEXT, allowNull: false },
      api_secret_encrypted: { type: Sequelize.TEXT, allowNull: true },
      webhook_secret: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.ENUM('connected', 'disconnected', 'error', 'pending_auth'), defaultValue: 'pending_auth', allowNull: false },
      last_synced_at: { type: Sequelize.DATE, allowNull: true },
      sync_enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
      auto_create_shipment: { type: Sequelize.BOOLEAN, defaultValue: false },
      order_status_filter: { type: Sequelize.ARRAY(Sequelize.TEXT), defaultValue: ['pending', 'processing'] },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('storefront_connections', ['seller_id'], { name: 'sc_seller_id_idx' });
    await queryInterface.addIndex('storefront_connections', ['platform', 'seller_id'], { name: 'sc_platform_seller_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('storefront_connections');
  },
};
