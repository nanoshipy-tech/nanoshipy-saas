'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenant_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      invoice_prefix_override: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'NULL = use platform default (INV)',
      },
      ndr_auto_rto_threshold_override: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'NULL = use platform default',
      },
      default_pickup_address_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'pickup_addresses', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'NULL = no default address set',
      },
      low_balance_threshold_override: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'NULL = use platform default',
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('tenant_settings', ['tenant_id'], {
      name: 'tenant_settings_tenant_id_idx',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenant_settings');
  },
};
