'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analytics_daily_snapshots', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: '00000000-0000-0000-0000-000000000000',
      },
      snapshot_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      orders_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      shipments_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      delivered_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      ndr_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rto_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cod_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      prepaid_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      shipping_spend: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      revenue_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique index on tenant_id + snapshot_date
    await queryInterface.addIndex('analytics_daily_snapshots', ['tenant_id', 'snapshot_date'], {
      unique: true,
      name: 'analytics_daily_snapshots_tenant_date_uq_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('analytics_daily_snapshots');
  },
};
