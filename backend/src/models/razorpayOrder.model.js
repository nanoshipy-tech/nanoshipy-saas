'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class RazorpayOrder extends Model {
    static associate(models) {
      RazorpayOrder.belongsTo(models.Tenant, { foreignKey: 'seller_id', as: 'seller' });
    }
  }
  RazorpayOrder.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    seller_id: { type: DataTypes.UUID, allowNull: false },
    razorpay_order_id: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    amount_paise: { type: DataTypes.BIGINT, allowNull: false },
    currency: { type: DataTypes.CHAR(3), defaultValue: 'INR' },
    status: { type: DataTypes.ENUM('created', 'paid', 'failed', 'refunded'), defaultValue: 'created' },
    razorpay_payment_id: { type: DataTypes.STRING(100), allowNull: true },
    razorpay_signature: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.JSONB, allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'RazorpayOrder', tableName: 'razorpay_orders', underscored: true, timestamps: true,
  });
  return RazorpayOrder;
};
