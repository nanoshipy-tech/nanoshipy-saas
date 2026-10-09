'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cod_remittances', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      seller_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      batch_reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      shipment_ids: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: false,
      },
      gross_cod_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      platform_fee_deducted: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      net_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      remittance_mode: {
        type: Sequelize.ENUM('wallet_credit', 'bank_payout'),
        allowNull: false,
        defaultValue: 'wallet_credit',
      },
      payout_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('cod_remittances', ['seller_id'], {
      name: 'cod_remittances_seller_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cod_remittances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cod_remittances_remittance_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cod_remittances_status";');
  },
};
