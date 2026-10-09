'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storefront_sync_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      connection_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'storefront_connections', key: 'id' }, onDelete: 'CASCADE' },
      trigger: { type: Sequelize.ENUM('webhook', 'manual', 'scheduled'), allowNull: false },
      orders_fetched: { type: Sequelize.INTEGER, defaultValue: 0 },
      orders_imported: { type: Sequelize.INTEGER, defaultValue: 0 },
      orders_skipped: { type: Sequelize.INTEGER, defaultValue: 0 },
      orders_failed: { type: Sequelize.INTEGER, defaultValue: 0 },
      error_details: { type: Sequelize.JSONB, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('storefront_sync_logs', ['connection_id'], { name: 'ssl_connection_id_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('storefront_sync_logs');
  },
};
