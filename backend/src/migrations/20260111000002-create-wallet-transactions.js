'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'wallets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.ENUM('recharge', 'shipment_debit', 'shipment_refund', 'manual_credit', 'manual_debit', 'adjustment'),
        allowNull: false,
      },
      reference_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      performed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
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
    });

    // Indexes
    await queryInterface.addIndex('wallet_transactions', ['wallet_id', 'created_at'], {
      name: 'wallet_transactions_wallet_created_idx',
    });
    await queryInterface.addIndex('wallet_transactions', ['tenant_id', 'created_at'], {
      name: 'wallet_transactions_tenant_created_idx',
    });
    await queryInterface.addIndex('wallet_transactions', ['reference_type', 'reference_id'], {
      name: 'wallet_transactions_ref_type_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wallet_transactions');
    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_transactions_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_transactions_reference_type";');
  },
};
