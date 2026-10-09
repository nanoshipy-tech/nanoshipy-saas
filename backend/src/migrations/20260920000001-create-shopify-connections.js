'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable('shopify_connections', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'tenants',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        shop_domain: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        connection_method: {
          type: Sequelize.ENUM('oauth', 'manual'),
          allowNull: false,
          defaultValue: 'manual',
        },
        access_token: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        scopes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        webhook_registered: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        status: {
          type: Sequelize.ENUM('connected', 'disconnected', 'token_invalid'),
          allowNull: false,
          defaultValue: 'connected',
        },
        webhook_secret: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        connected_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        last_synced_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      });
    } catch (_) {}

    await queryInterface.addIndex('shopify_connections', ['tenant_id'], {
      name: 'shopify_connections_tenant_id_idx',
    }).catch(() => {});
    await queryInterface.addIndex('shopify_connections', ['tenant_id', 'shop_domain'], {
      name: 'shopify_connections_tenant_shop_unique',
      unique: true,
    }).catch(() => {});
    await queryInterface.addIndex('shopify_connections', ['shop_domain'], {
      name: 'shopify_connections_shop_domain_idx',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shopify_connections');
  },
};
