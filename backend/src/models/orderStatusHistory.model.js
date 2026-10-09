const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Order = require('./order.model');
const User = require('./user.model');

const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Order,
      key: 'id',
    },
  },
  old_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  new_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  changed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'order_status_histories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = OrderStatusHistory;
