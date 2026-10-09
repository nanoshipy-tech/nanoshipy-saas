'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('platform_audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      platform_admin_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'platform_admins',
          key: 'id',
        },
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      target_tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      entity_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      entity_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(50),
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

    await queryInterface.addIndex('platform_audit_logs', ['target_tenant_id', 'created_at']);
    await queryInterface.addIndex('platform_audit_logs', ['platform_admin_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('platform_audit_logs');
  }
};
