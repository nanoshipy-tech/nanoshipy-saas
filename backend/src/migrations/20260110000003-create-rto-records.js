'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rto_records', {
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
      shipment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'shipments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      initiated_reason: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      initiated_by: {
        type: Sequelize.ENUM('manual', 'auto_ndr_threshold', 'courier_initiated'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('rto_initiated', 'rto_in_transit', 'rto_delivered', 'rto_lost'),
        allowNull: false,
        defaultValue: 'rto_initiated',
      },
      rto_awb_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      expected_return_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      received_at_warehouse_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Indexes
    await queryInterface.addIndex('rto_records', ['tenant_id', 'status'], {
      name: 'rto_records_tenant_id_status_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rto_records');
    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rto_records_initiated_by";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rto_records_status";');
  },
};
