'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.createTable('webhook_endpoints', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        url: {
          type: Sequelize.STRING(500),
          allowNull: false,
        },
        secret: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        events: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: [],
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        description: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        consecutive_failures: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    } catch (_) {}

    await queryInterface.addIndex('webhook_endpoints', ['tenant_id', 'is_active'], {
      name: 'idx_webhook_endpoints_tenant_active',
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('webhook_endpoints');
  },
};
