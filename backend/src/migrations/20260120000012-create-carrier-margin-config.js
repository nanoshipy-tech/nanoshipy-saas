'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('carrier_margin_configs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      carrier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courier_providers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      seller_tier: {
        type: Sequelize.ENUM('standard', 'growth', 'enterprise', 'all'),
        allowNull: false,
        defaultValue: 'all',
      },
      seller_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      margin_type: {
        type: Sequelize.ENUM('flat', 'percentage'),
        allowNull: false,
        defaultValue: 'flat',
      },
      margin_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      effective_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE'),
      },
      effective_until: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'platform_admins',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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

    await queryInterface.addIndex('carrier_margin_configs', ['carrier_id', 'seller_tier', 'seller_id'], {
      name: 'carrier_margin_configs_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('carrier_margin_configs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_carrier_margin_configs_seller_tier";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_carrier_margin_configs_margin_type";');
  },
};
