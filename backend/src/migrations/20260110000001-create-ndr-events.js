'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ndr_events', {
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
        references: {
          model: 'shipments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tracking_event_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tracking_events',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reason_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      raw_reason: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      attempt_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: Sequelize.ENUM('open', 'action_taken', 'resolved_delivered', 'resolved_rto'),
        allowNull: false,
        defaultValue: 'open',
      },
      sla_due_at: {
        type: Sequelize.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('ndr_events', ['tenant_id', 'status'], {
      name: 'ndr_events_tenant_id_status_idx',
    });
    await queryInterface.addIndex('ndr_events', ['shipment_id'], {
      name: 'ndr_events_shipment_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ndr_events');
    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ndr_events_status";');
  },
};
