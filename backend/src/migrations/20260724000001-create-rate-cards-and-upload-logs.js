'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create rate_cards table
    await queryInterface.createTable('rate_cards', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      courier_provider_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      courier_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      zone: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      service_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'surface',
      },
      min_weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: false,
        defaultValue: 0.000,
      },
      max_weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: false,
      },
      base_rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      additional_weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: true,
        defaultValue: 0.500,
      },
      additional_rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      cod_charge_flat: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      cod_charge_percent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by: {
        type: Sequelize.UUID,
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

    // 2. Create rate_card_upload_logs table
    await queryInterface.createTable('rate_card_upload_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      uploaded_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      import_mode: {
        type: Sequelize.ENUM('replace', 'append'),
        allowNull: false,
        defaultValue: 'append',
      },
      total_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      success_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_details: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('success', 'partial_success', 'failed'),
        allowNull: false,
        defaultValue: 'success',
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('rate_card_upload_logs');
    await queryInterface.dropTable('rate_cards');
  },
};
