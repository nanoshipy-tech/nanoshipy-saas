'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ordersTable = await queryInterface.describeTable('orders');

    if (!ordersTable.sender_address_line1) {
      await queryInterface.addColumn('orders', 'sender_address_line1', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.sender_address_line2) {
      await queryInterface.addColumn('orders', 'sender_address_line2', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.sender_city) {
      await queryInterface.addColumn('orders', 'sender_city', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.sender_state) {
      await queryInterface.addColumn('orders', 'sender_state', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.sender_pincode) {
      await queryInterface.addColumn('orders', 'sender_pincode', {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const ordersTable = await queryInterface.describeTable('orders');

    if (ordersTable.sender_address_line1) {
      await queryInterface.removeColumn('orders', 'sender_address_line1');
    }
    if (ordersTable.sender_address_line2) {
      await queryInterface.removeColumn('orders', 'sender_address_line2');
    }
    if (ordersTable.sender_city) {
      await queryInterface.removeColumn('orders', 'sender_city');
    }
    if (ordersTable.sender_state) {
      await queryInterface.removeColumn('orders', 'sender_state');
    }
    if (ordersTable.sender_pincode) {
      await queryInterface.removeColumn('orders', 'sender_pincode');
    }
  },
};
