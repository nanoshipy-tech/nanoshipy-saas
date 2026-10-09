'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weight_discrepancy_disputes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      seller_id: {
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
      awb: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      declared_weight_kg: {
        type: Sequelize.DECIMAL(8, 3),
        allowNull: false,
      },
      courier_weight_kg: {
        type: Sequelize.DECIMAL(8, 3),
        allowNull: false,
      },
      disputed_charge: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('open', 'under_review', 'accepted', 'rejected', 'reversed'),
        allowNull: false,
        defaultValue: 'open',
      },
      seller_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      admin_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      evidence_s3_keys: {
        type: Sequelize.ARRAY(Sequelize.STRING(500)),
        allowNull: true,
      },
      raised_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_admins',
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
      },
    });

    await queryInterface.addIndex('weight_discrepancy_disputes', ['seller_id'], {
      name: 'weight_discrepancy_disputes_seller_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('weight_discrepancy_disputes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_weight_discrepancy_disputes_status";');
  },
};
