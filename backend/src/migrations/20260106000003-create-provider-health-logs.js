'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_health_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      courier_provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courier_providers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      healthy: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      checked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('provider_health_logs', ['courier_provider_id', 'checked_at'], {
      name: 'provider_health_logs_provider_checked_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('provider_health_logs');
  },
};
