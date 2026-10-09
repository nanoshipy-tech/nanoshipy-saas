'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('api_key_usage_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      api_key_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'api_keys',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      endpoint: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      method: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      status_code: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      response_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    await queryInterface.addIndex('api_key_usage_logs', ['api_key_id', 'created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('api_key_usage_logs');
  },
};
