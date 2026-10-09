'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ndr_actions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      ndr_event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'ndr_events',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      action_type: {
        type: Sequelize.ENUM('reattempt', 'update_address', 'update_phone', 'mark_rto', 'call_customer', 'no_action'),
        allowNull: false,
      },
      notes: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      updated_address_line1: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      updated_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      performed_by: {
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
    });

    // Indexes
    await queryInterface.addIndex('ndr_actions', ['ndr_event_id', 'created_at'], {
      name: 'ndr_actions_ndr_event_id_created_at_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ndr_actions');
    // Drop enum type if postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ndr_actions_action_type";');
  },
};
