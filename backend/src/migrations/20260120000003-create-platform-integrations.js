'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_integrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      integration_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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

    // Seed default catalogue
    await queryInterface.bulkInsert('platform_integrations', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        integration_key: 'shopify',
        display_name: 'Shopify Storefront',
        is_active: true,
        config: JSON.stringify({ api_version: '2024-01', webhooks_supported: ['orders/create', 'orders/updated'] }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        integration_key: 'woocommerce',
        display_name: 'WooCommerce Store',
        is_active: true,
        config: JSON.stringify({ api_version: 'v3', webhooks_supported: ['order.created', 'order.updated'] }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        integration_key: 'amazon',
        display_name: 'Amazon Seller Central',
        is_active: true,
        config: JSON.stringify({ api_version: 'v1', webhooks_supported: ['ORDER_CHANGE'] }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        integration_key: 'custom_api',
        display_name: 'Custom REST API / Webhook',
        is_active: true,
        config: JSON.stringify({ api_version: 'v1' }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.dropTable('platform_integrations');
  },
};
