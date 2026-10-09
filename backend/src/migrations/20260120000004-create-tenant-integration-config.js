'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenant_integration_configs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform_integration_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'platform_integrations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      credentials_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      store_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sync_orders_automatically: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync_status: {
        type: Sequelize.ENUM('success', 'failed'),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tenant_integration_configs', ['tenant_id', 'platform_integration_id'], {
      unique: true,
      name: 'unique_tenant_platform_integration',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenant_integration_configs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tenant_integration_configs_last_sync_status";');
  },
};
