'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Orders additive columns
    const orderTable = await queryInterface.describeTable('orders');
    if (!orderTable.sandbox) {
      await queryInterface.addColumn('orders', 'sandbox', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
    if (!orderTable.whatsapp_opted_in) {
      await queryInterface.addColumn('orders', 'whatsapp_opted_in', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      });
    }

    // 2. Shipments additive columns
    const shipmentTable = await queryInterface.describeTable('shipments');
    if (!shipmentTable.sandbox) {
      await queryInterface.addColumn('shipments', 'sandbox', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }

    // 3. Wallet Transactions additive columns
    const txTable = await queryInterface.describeTable('wallet_transactions');
    if (!txTable.invoice_s3_key) {
      await queryInterface.addColumn('wallet_transactions', 'invoice_s3_key', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }

    // 4. Support Tickets additive columns
    const ticketTable = await queryInterface.describeTable('support_tickets');
    if (!ticketTable.sla_breached) {
      await queryInterface.addColumn('support_tickets', 'sla_breached', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'sandbox');
    await queryInterface.removeColumn('orders', 'whatsapp_opted_in');
    await queryInterface.removeColumn('shipments', 'sandbox');
    await queryInterface.removeColumn('wallet_transactions', 'invoice_s3_key');
    await queryInterface.removeColumn('support_tickets', 'sla_breached');
  },
};
