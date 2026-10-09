'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_recharge_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      seller_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      razorpay_order_id: { type: Sequelize.STRING(100), allowNull: false },
      amount_rupees: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: { type: Sequelize.ENUM('initiated', 'success', 'failed', 'refunded'), defaultValue: 'initiated', allowNull: false },
      wallet_ledger_entry_id: { type: Sequelize.UUID, allowNull: true },
      failure_reason: { type: Sequelize.TEXT, allowNull: true },
      initiated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('wallet_recharge_requests', ['seller_id'], { name: 'wrr_seller_id_idx' });
    await queryInterface.addIndex('wallet_recharge_requests', ['razorpay_order_id'], { name: 'wrr_rzp_order_id_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('wallet_recharge_requests');
  },
};
