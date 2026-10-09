'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('settings_change_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      scope: {
        type: Sequelize.ENUM('tenant', 'platform'),
        allowNull: false,
      },
      scope_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'tenant_id when scope=tenant, NULL when scope=platform',
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      old_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'NULL if this is the first write (no previous value)',
      },
      new_value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'user_id (tenant) or platform_admin_id — polymorphic, no FK constraint to keep it flexible',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('settings_change_history', ['scope', 'scope_id'], {
      name: 'settings_change_history_scope_idx',
    });

    await queryInterface.addIndex('settings_change_history', ['setting_key'], {
      name: 'settings_change_history_key_idx',
    });

    await queryInterface.addIndex('settings_change_history', ['created_at'], {
      name: 'settings_change_history_created_at_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('settings_change_history');
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_settings_change_history_scope;"
    );
  },
};
