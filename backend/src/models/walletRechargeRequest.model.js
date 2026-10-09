'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class WalletRechargeRequest extends Model {
    static associate(models) {
      WalletRechargeRequest.belongsTo(models.Tenant, { foreignKey: 'seller_id', as: 'seller' });
    }
  }
  WalletRechargeRequest.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    seller_id: { type: DataTypes.UUID, allowNull: false },
    razorpay_order_id: { type: DataTypes.STRING(100), allowNull: false },
    amount_rupees: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.ENUM('initiated', 'success', 'failed', 'refunded'), defaultValue: 'initiated' },
    wallet_ledger_entry_id: { type: DataTypes.UUID, allowNull: true },
    failure_reason: { type: DataTypes.TEXT, allowNull: true },
    initiated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'WalletRechargeRequest', tableName: 'wallet_recharge_requests', underscored: true, timestamps: true,
  });
  return WalletRechargeRequest;
};
