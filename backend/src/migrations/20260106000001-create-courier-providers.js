'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('courier_providers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      provider_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      logo_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      credentials_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      config: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {},
      },
      supports_cod: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      supports_prepaid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      max_weight_kg: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
      },
      service_types: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_admins',
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

    await queryInterface.addIndex('courier_providers', ['provider_key'], {
      unique: true,
      name: 'courier_providers_key_unique_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('courier_providers');
  },
};
