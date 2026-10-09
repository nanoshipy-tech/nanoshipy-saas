'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('credit_notes', {
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
      original_invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'invoices',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      credit_note_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.ENUM('shipment_cancelled', 'shipment_rto', 'manual'),
        allowNull: false,
      },
      reference_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      pdf_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Indexes
    await queryInterface.addIndex('credit_notes', ['tenant_id', 'created_at'], {
      name: 'credit_notes_tenant_created_idx',
    });
    await queryInterface.addIndex('credit_notes', ['original_invoice_id'], {
      name: 'credit_notes_orig_invoice_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('credit_notes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_credit_notes_reference_type";');
  },
};
