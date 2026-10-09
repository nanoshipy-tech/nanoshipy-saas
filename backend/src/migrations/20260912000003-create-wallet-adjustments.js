'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('wallet_adjustments').catch(() => null);

    if (!tableInfo) {
      await queryInterface.createTable('wallet_adjustments', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
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
        admin_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'platform_admins',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        type: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
        reason: {
          type: Sequelize.STRING(500),
          allowNull: false,
        },
        idempotency_key: {
          type: Sequelize.STRING(100),
          allowNull: true,
          unique: true,
        },
        reference_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        new_balance: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallet_adjustments');
  },
};
