'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recharge_orders', {
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
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      gateway: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'razorpay',
      },
      gateway_order_id: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      gateway_payment_id: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('created', 'pending', 'success', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'created',
      },
      initiated_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
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

    // Indexes
    await queryInterface.addIndex('recharge_orders', ['tenant_id', 'status'], {
      name: 'recharge_orders_tenant_status_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('recharge_orders');
    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_recharge_orders_status";');
  },
};
