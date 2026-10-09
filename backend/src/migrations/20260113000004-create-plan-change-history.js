'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plan_change_history', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      old_plan_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'subscription_plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      new_plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      change_type: {
        type: Sequelize.ENUM('upgrade', 'downgrade', 'renewal', 'initial'),
        allowNull: false,
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('plan_change_history', ['tenant_id', 'created_at'], {
      name: 'plan_change_history_tenant_created_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('plan_change_history');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_plan_change_history_change_type";');
  },
};
