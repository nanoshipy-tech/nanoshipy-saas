'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');
const Tenant = require('./tenant.model');
const Order = require('./order.model');
const CourierProvider = require('./courierProvider.model');
const PickupAddress = require('./pickupAddress.model');
const User = require('./user.model');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id',
    },
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Order,
      key: 'id',
    },
  },
  parent_shipment_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shipments',
      key: 'id',
    },
  },
  courier_provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CourierProvider,
      key: 'id',
    },
  },
  pickup_address_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: PickupAddress,
      key: 'id',
    },
  },
  manifest_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  awb_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  courier_shipment_id: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  service_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  selected_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  sell_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  cost_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  margin_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  cod_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  declared_weight_kg: {
    type: DataTypes.DECIMAL(6, 3),
    allowNull: false,
  },
  charged_weight_kg: {
    type: DataTypes.DECIMAL(6, 3),
    allowNull: true,
  },
  weight_discrepancy_flag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  is_delayed_flag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'created',
  },
  label_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  estimated_delivery_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  provider_raw_response: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  sandbox: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  tableName: 'shipments',
  timestamps: true,
  paranoid: true,
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  defaultScope: {
    attributes: { exclude: ['provider_raw_response'] },
  },
  scopes: {
    detailed: {
      attributes: {},
    },
  },
});

module.exports = Shipment;
