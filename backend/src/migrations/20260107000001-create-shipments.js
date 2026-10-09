'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipments', {
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
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      courier_provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courier_providers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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
      awb_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      courier_shipment_id: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      service_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      selected_rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      cod_charge: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      declared_weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: false,
      },
      charged_weight_kg: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: true,
      },
      weight_discrepancy_flag: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.ENUM(
          'created',
          'awb_generated',
          'pickup_scheduled',
          'picked_up',
          'in_transit',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'failed'
        ),
        allowNull: false,
        defaultValue: 'created',
      },
      label_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      estimated_delivery_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      provider_raw_response: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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
      },
    });

    await queryInterface.addIndex('shipments', ['tenant_id', 'status'], {
      name: 'shipments_tenant_status_idx',
    });

    await queryInterface.addIndex('shipments', ['awb_number'], {
      name: 'shipments_awb_number_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shipments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_shipments_status";');
  },
};
