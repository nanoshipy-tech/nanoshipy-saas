'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('st_courier_awb_inventories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      awb_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      origin_district: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'All',
      },
      payment_mode: {
        type: Sequelize.ENUM('prepaid', 'cod', 'both'),
        allowNull: false,
        defaultValue: 'both',
      },
      status: {
        type: Sequelize.ENUM('available', 'assigned', 'used', 'cancelled'),
        allowNull: false,
        defaultValue: 'available',
      },
      shipment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shipments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      batch_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      notes: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Fast allocation index: find available AWBs for district and payment mode
    await queryInterface.addIndex('st_courier_awb_inventories', ['status', 'origin_district', 'payment_mode'], {
      name: 'idx_st_awb_status_district_payment',
    });

    // Fast lookup index by shipment_id
    await queryInterface.addIndex('st_courier_awb_inventories', ['shipment_id'], {
      name: 'idx_st_awb_shipment_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('st_courier_awb_inventories');
    // Drop enums created in PostgreSQL
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_st_courier_awb_inventories_payment_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_st_courier_awb_inventories_status";');
  },
};
