'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ordersTable = await queryInterface.describeTable('orders');

    if (!ordersTable.storefront_connection_id) {
      await queryInterface.addColumn('orders', 'storefront_connection_id', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.external_order_id) {
      await queryInterface.addColumn('orders', 'external_order_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.booking_type) {
      await queryInterface.addColumn('orders', 'booking_type', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'regular',
      });
    }

    if (!ordersTable.sender_name) {
      await queryInterface.addColumn('orders', 'sender_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.sender_phone) {
      await queryInterface.addColumn('orders', 'sender_phone', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.consignment_type) {
      await queryInterface.addColumn('orders', 'consignment_type', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'non_document',
      });
    }

    if (!ordersTable.counter_payment_method) {
      await queryInterface.addColumn('orders', 'counter_payment_method', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.counter_amount_collected) {
      await queryInterface.addColumn('orders', 'counter_amount_collected', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.counter_notes) {
      await queryInterface.addColumn('orders', 'counter_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!ordersTable.deleted_at) {
      await queryInterface.addColumn('orders', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    // Add unique index on storefront_connection_id + external_order_id
    try {
      await queryInterface.addIndex('orders', ['storefront_connection_id', 'external_order_id'], {
        name: 'orders_storefront_connection_id_external_order_id',
        unique: true,
      });
    } catch (_) {}
  },

  async down(queryInterface) {
    const ordersTable = await queryInterface.describeTable('orders');

    try {
      await queryInterface.removeIndex('orders', 'orders_storefront_connection_id_external_order_id');
    } catch (_) {}

    const cols = [
      'storefront_connection_id',
      'external_order_id',
      'booking_type',
      'sender_name',
      'sender_phone',
      'consignment_type',
      'counter_payment_method',
      'counter_amount_collected',
      'counter_notes',
      'deleted_at'
    ];

    for (const col of cols) {
      if (ordersTable[col]) {
        await queryInterface.removeColumn('orders', col);
      }
    }
  },
};
