'use strict';

/**
 * Migration: Create tables for My Dreams Technology SMS integration
 * - my_dreams_sms_templates: DLT template definitions & variable order mapping
 * - my_dreams_sms_otps: Securely hashed OTPs with expiry & attempt counters
 * - my_dreams_sms_logs: Dedicated transmission audit log with masked numbers
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. my_dreams_sms_templates
    await queryInterface.createTable('my_dreams_sms_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      template_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      template_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      template_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      variable_order: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      dlt_template_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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

    // 2. my_dreams_sms_otps
    await queryInterface.createTable('my_dreams_sms_otps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      otp_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      salt: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      verified_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('my_dreams_sms_otps', ['phone_number'], {
      name: 'idx_my_dreams_otps_phone',
    });

    // 3. my_dreams_sms_logs
    await queryInterface.createTable('my_dreams_sms_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      phone_masked: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      template_key: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      order_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status_event: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false, // 'sent', 'failed', 'skipped', 'simulated'
      },
      request_url_masked: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      vendor_response: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
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

    await queryInterface.addIndex('my_dreams_sms_logs', ['order_id', 'status_event'], {
      name: 'idx_my_dreams_logs_order_event',
    });

    // Seed default template definitions
    const now = new Date();
    await queryInterface.bulkInsert('my_dreams_sms_templates', [
      {
        id: '11111111-1111-4111-a111-111111111111',
        template_key: 'otp',
        template_name: 'Login / Verification OTP',
        template_text: 'Dear {#var#}, Your OTP for login to {#var#}. Valid for 30 minutes. Please do not share this OTP. Regards, My Dreams Technology Team',
        variable_order: JSON.stringify(['name', 'otp']),
        dlt_template_id: '',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        template_key: 'order_confirmed',
        template_name: 'Order Confirmation',
        template_text: 'Dear {#var#}, your order #{#var#} has been confirmed. Thank you for shopping with us! Regards, My Dreams Technology Team',
        variable_order: JSON.stringify(['customer_name', 'order_number']),
        dlt_template_id: '',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        template_key: 'out_for_delivery',
        template_name: 'Out For Delivery Alert',
        template_text: 'Dear {#var#}, your order #{#var#} is out for delivery today. Regards, My Dreams Technology Team',
        variable_order: JSON.stringify(['customer_name', 'order_number']),
        dlt_template_id: '',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: '44444444-4444-4444-a444-444444444444',
        template_key: 'tracking',
        template_name: 'Live Shipment Tracking Link',
        template_text: 'Dear {#var#}, track your order #{#var#} live at {#var#}. Regards, My Dreams Technology Team',
        variable_order: JSON.stringify(['customer_name', 'order_number', 'tracking_url']),
        dlt_template_id: '',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('my_dreams_sms_logs');
    await queryInterface.dropTable('my_dreams_sms_otps');
    await queryInterface.dropTable('my_dreams_sms_templates');
  },
};
