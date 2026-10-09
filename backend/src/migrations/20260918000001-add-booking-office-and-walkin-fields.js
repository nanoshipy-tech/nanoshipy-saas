'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add is_booking_office to tenants table
    const tenantsTable = await queryInterface.describeTable('tenants');
    if (!tenantsTable.is_booking_office) {
      await queryInterface.addColumn('tenants', 'is_booking_office', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // 2. Add is_walkin and amount_collected to orders table
    const ordersTable = await queryInterface.describeTable('orders');
    if (!ordersTable.is_walkin) {
      await queryInterface.addColumn('orders', 'is_walkin', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!ordersTable.amount_collected) {
      await queryInterface.addColumn('orders', 'amount_collected', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const tenantsTable = await queryInterface.describeTable('tenants');
    if (tenantsTable.is_booking_office) {
      await queryInterface.removeColumn('tenants', 'is_booking_office');
    }

    const ordersTable = await queryInterface.describeTable('orders');
    if (ordersTable.is_walkin) {
      await queryInterface.removeColumn('orders', 'is_walkin');
    }
    if (ordersTable.amount_collected) {
      await queryInterface.removeColumn('orders', 'amount_collected');
    }
  },
};
