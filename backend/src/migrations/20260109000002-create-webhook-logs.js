'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('webhook_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      courier_provider_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'courier_providers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      headers: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      signature_valid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      processed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      processing_error: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      processed_at: {
        type: Sequelize.DATE,
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

    // Add indexes
    await queryInterface.addIndex('webhook_logs', ['courier_provider_id', 'received_at'], {
      name: 'webhook_logs_provider_received_idx',
    });

    await queryInterface.addIndex('webhook_logs', ['processed'], {
      name: 'webhook_logs_processed_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('webhook_logs');
  },
};
