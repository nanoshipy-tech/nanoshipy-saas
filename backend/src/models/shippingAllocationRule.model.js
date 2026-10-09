'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ShippingAllocationRule = sequelize.define('ShippingAllocationRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  scope: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'global', // 'global', 'seller', 'booking_office'
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  pickup_address_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  payment_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'all', // 'all', 'prepaid', 'cod', 'to_pay'
  },
  zone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'all', // 'all', 'intra_state', 'regional', 'metro', 'rest_of_india', 'special', 'Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'
  },
  min_weight_kg: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('min_weight_kg');
      return val != null ? parseFloat(val) : 0.00;
    },
  },
  max_weight_kg: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 999.00,
    get() {
      const val = this.getDataValue('max_weight_kg');
      return val != null ? parseFloat(val) : 999.00;
    },
  },
  min_order_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  max_order_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 999999.00,
  },
  strategy: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'priority_fallback', // 'priority_fallback', 'cheapest', 'fastest'
  },
  // Up to 5 couriers in priority sequence: [{ priority: 1, courier_key: "80622", name: "Delhivery Surface", service_type: "80622" }, ...]
  courier_priorities: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    get() {
      const raw = this.getDataValue('courier_priorities');
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return [];
        }
      }
      return Array.isArray(raw) ? raw : [];
    },
    set(val) {
      if (Array.isArray(val)) {
        // Enforce maximum 5 couriers per rule
        this.setDataValue('courier_priorities', val.slice(0, 5));
      } else {
        this.setDataValue('courier_priorities', []);
      }
    },
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'shipping_allocation_rules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['scope', 'tenant_id', 'pickup_address_id', 'is_active', 'priority'],
    },
  ],
});

module.exports = ShippingAllocationRule;
