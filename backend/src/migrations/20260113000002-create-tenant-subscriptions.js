'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenant_subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('active', 'grace_period', 'suspended', 'cancelled'),
        allowNull: false,
        defaultValue: 'active',
      },
      billing_cycle: {
        type: Sequelize.ENUM('monthly', 'yearly'),
        allowNull: false,
        defaultValue: 'monthly',
      },
      current_period_start: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      current_period_end: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      grace_period_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      auto_renew: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      pending_plan_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'subscription_plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('tenant_subscriptions', ['status', 'current_period_end'], {
      name: 'tenant_subscriptions_status_end_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tenant_subscriptions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tenant_subscriptions_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tenant_subscriptions_billing_cycle";');
  },
};
