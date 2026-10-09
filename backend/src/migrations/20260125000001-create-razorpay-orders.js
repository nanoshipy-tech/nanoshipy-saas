'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('razorpay_orders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      seller_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      razorpay_order_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      amount_paise: { type: Sequelize.BIGINT, allowNull: false },
      currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'INR' },
      status: { type: Sequelize.ENUM('created', 'paid', 'failed', 'refunded'), defaultValue: 'created', allowNull: false },
      razorpay_payment_id: { type: Sequelize.STRING(100), allowNull: true },
      razorpay_signature: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      paid_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('razorpay_orders', ['seller_id'], { name: 'razorpay_orders_seller_id_idx' });
    await queryInterface.addIndex('razorpay_orders', ['razorpay_order_id'], { name: 'razorpay_orders_rzp_order_id_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('razorpay_orders');
  },
};
