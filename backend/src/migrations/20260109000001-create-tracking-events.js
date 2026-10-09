'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tracking_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      raw_status: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      remark: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      event_timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('webhook', 'poll', 'manual'),
        allowNull: false,
      },
      ingested_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('tracking_events', ['shipment_id', 'event_timestamp'], {
      name: 'tracking_events_shipment_id_event_timestamp_idx',
    });

    await queryInterface.addIndex('tracking_events', ['shipment_id', 'raw_status', 'event_timestamp'], {
      unique: true,
      name: 'tracking_events_shipment_raw_timestamp_uniq',
    });

    // Add is_delayed_flag to shipments
    await queryInterface.addColumn('shipments', 'is_delayed_flag', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove column
    await queryInterface.removeColumn('shipments', 'is_delayed_flag');

    // Drop table
    await queryInterface.dropTable('tracking_events');

    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tracking_events_source";');
  },
};
