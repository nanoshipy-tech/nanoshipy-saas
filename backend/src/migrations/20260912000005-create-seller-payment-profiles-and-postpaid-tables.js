'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. seller_payment_profiles
    await queryInterface.createTable('seller_payment_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      payment_mode: {
        type: Sequelize.ENUM('prepaid', 'postpaid'),
        defaultValue: 'prepaid',
        allowNull: false,
      },
      credit_limit: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      outstanding_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      reserved_credit: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      billing_cycle: {
        type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
        defaultValue: 'weekly',
        allowNull: false,
      },
      payment_terms_days: {
        type: Sequelize.INTEGER,
        defaultValue: 7,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended', 'grace_period'),
        defaultValue: 'active',
        allowNull: false,
      },
      grace_period_days: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        allowNull: false,
      },
      auto_debit_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      settlement_bank_account: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // 2. seller_payment_terms_history
    await queryInterface.createTable('seller_payment_terms_history', {
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
        onDelete: 'CASCADE',
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_admins',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      previous_mode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      new_mode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      previous_credit_limit: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      new_credit_limit: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      previous_billing_cycle: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      new_billing_cycle: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // 3. postpaid_invoices
    await queryInterface.createTable('postpaid_invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      billing_period_start: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      billing_period_end: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      subtotal_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      tax_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      total_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      paid_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'),
        defaultValue: 'issued',
        allowNull: false,
      },
      pdf_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      line_items: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // 4. postpaid_transactions
    await queryInterface.createTable('postpaid_transactions', {
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
        onDelete: 'CASCADE',
      },
      shipment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shipments',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'postpaid_invoices',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('debit', 'credit', 'adjustment', 'reserve', 'release'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reference_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // 5. postpaid_payments
    await queryInterface.createTable('postpaid_payments', {
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
        onDelete: 'CASCADE',
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'postpaid_invoices',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      payment_method: {
        type: Sequelize.ENUM('razorpay', 'bank_transfer', 'cheque', 'manual_adjustment'),
        defaultValue: 'bank_transfer',
        allowNull: false,
      },
      payment_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      recorded_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_admins',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Indices for high-frequency queries
    await queryInterface.addIndex('seller_payment_profiles', ['tenant_id']);
    await queryInterface.addIndex('seller_payment_profiles', ['payment_mode', 'status']);
    await queryInterface.addIndex('postpaid_transactions', ['tenant_id', 'created_at']);
    await queryInterface.addIndex('postpaid_transactions', ['shipment_id']);
    await queryInterface.addIndex('postpaid_invoices', ['tenant_id', 'status']);
    await queryInterface.addIndex('postpaid_invoices', ['due_date']);
    await queryInterface.addIndex('postpaid_payments', ['tenant_id', 'invoice_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('postpaid_payments');
    await queryInterface.dropTable('postpaid_transactions');
    await queryInterface.dropTable('postpaid_invoices');
    await queryInterface.dropTable('seller_payment_terms_history');
    await queryInterface.dropTable('seller_payment_profiles');
  },
};
