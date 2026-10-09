'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      price_monthly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      price_yearly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      max_orders_per_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_users: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_pickup_addresses: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      courier_access_tier: {
        type: Sequelize.ENUM('basic', 'standard', 'all'),
        allowNull: false,
        defaultValue: 'basic',
      },
      support_tier: {
        type: Sequelize.ENUM('email', 'priority', 'dedicated'),
        allowNull: false,
        defaultValue: 'email',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    // Add min_plan_tier to courier_providers
    await queryInterface.addColumn('courier_providers', 'min_plan_tier', {
      type: Sequelize.ENUM('basic', 'standard', 'all'),
      allowNull: false,
      defaultValue: 'basic',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('courier_providers', 'min_plan_tier');
    await queryInterface.dropTable('subscription_plans');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscription_plans_courier_access_tier";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscription_plans_support_tier";');
  },
};
