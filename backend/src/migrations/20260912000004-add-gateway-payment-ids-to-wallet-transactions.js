'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('wallet_transactions').catch(() => ({}));

    if (!tableInfo.gateway_payment_id) {
      await queryInterface.addColumn('wallet_transactions', 'gateway_payment_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!tableInfo.razorpay_payment_id) {
      await queryInterface.addColumn('wallet_transactions', 'razorpay_payment_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('wallet_transactions').catch(() => ({}));

    if (tableInfo.razorpay_payment_id) {
      await queryInterface.removeColumn('wallet_transactions', 'razorpay_payment_id');
    }

    if (tableInfo.gateway_payment_id) {
      await queryInterface.removeColumn('wallet_transactions', 'gateway_payment_id');
    }
  },
};
