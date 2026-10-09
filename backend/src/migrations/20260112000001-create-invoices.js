'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
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
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      invoice_type: {
        type: Sequelize.ENUM('shipment', 'monthly_statement', 'manual'),
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.ENUM('shipment', 'wallet_recharge', 'period'),
        allowNull: false,
      },
      reference_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      billing_period_start: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      billing_period_end: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      cgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      sgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      igst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('generated', 'paid', 'void'),
        allowNull: false,
        defaultValue: 'generated',
      },
      pdf_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      billing_entity_gstin: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      place_of_supply: {
        type: Sequelize.STRING(100),
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
    await queryInterface.addIndex('invoices', ['tenant_id', 'created_at'], {
      name: 'invoices_tenant_created_idx',
    });
    await queryInterface.addIndex('invoices', ['reference_type', 'reference_id'], {
      name: 'invoices_ref_type_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invoices');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invoices_invoice_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invoices_reference_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invoices_status";');
  },
};
