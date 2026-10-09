'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      order_reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      pickup_address_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'pickup_addresses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      customer_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      customer_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      customer_email: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      shipping_address_line1: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      shipping_address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      shipping_city: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      shipping_state: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      shipping_pincode: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      shipping_country: {
        type: Sequelize.STRING(100),
        defaultValue: 'India',
      },
      order_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      payment_mode: {
        type: Sequelize.ENUM('prepaid', 'cod'),
        allowNull: false,
      },
      cod_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: false,
      },
      length_cm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      width_cm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      height_cm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'ready_to_ship', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('manual', 'bulk_import', 'api'),
        defaultValue: 'manual',
        allowNull: false,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });

    await queryInterface.addIndex('orders', ['tenant_id', 'status'], {
      name: 'orders_tenant_status_idx',
    });

    // Unique index on tenant_id + order_reference
    await queryInterface.addIndex('orders', ['tenant_id', 'order_reference'], {
      unique: true,
      name: 'orders_tenant_order_reference_unique_idx',
    });

    await queryInterface.addIndex('orders', ['tenant_id', 'created_at'], {
      name: 'orders_tenant_created_at_idx',
    });

    await queryInterface.addIndex('orders', ['customer_phone'], {
      name: 'orders_customer_phone_idx',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('orders');
    // Drop Enum type created for status/source/payment_mode if necessary, but in Postgres, Sequelize dropTable handles standard types, and enums can sometimes leave types. Postgres doesn't drop enum types automatically on dropTable. 
    // Usually it is safe to leave them or drop them. We will drop them to be clean if needed, but since it's just tests/migrations it's fine.
  }
};
