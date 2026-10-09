'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipment_status_histories', {
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
      old_status: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      new_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('manual', 'provider_webhook', 'system'),
        allowNull: false,
        defaultValue: 'system',
      },
      note: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('shipment_status_histories', ['shipment_id', 'created_at'], {
      name: 'shipment_status_histories_shipment_created_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shipment_status_histories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_shipment_status_histories_source";');
  },
};
