'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      setting_value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      value_type: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'json'),
        allowNull: false,
        defaultValue: 'string',
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'platform_admins', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('platform_settings', ['setting_key'], {
      name: 'platform_settings_key_idx',
      unique: true,
    });

    // Seed default platform settings
    const now = new Date();
    await queryInterface.bulkInsert('platform_settings', [
      {
        id: require('crypto').randomUUID(),
        setting_key: 'default_gst_rate_percent',
        setting_value: '18',
        value_type: 'number',
        description: 'Default GST rate applied to invoices (percentage). Overrides env GST_RATE_PERCENT.',
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: require('crypto').randomUUID(),
        setting_key: 'default_ndr_auto_rto_threshold',
        setting_value: '3',
        value_type: 'number',
        description: 'Number of failed delivery attempts before auto-triggering RTO. Tenant can override.',
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: require('crypto').randomUUID(),
        setting_key: 'default_low_balance_threshold',
        setting_value: '500',
        value_type: 'number',
        description: 'Wallet balance below which a low-balance notification is sent (INR). Tenant can override.',
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: require('crypto').randomUUID(),
        setting_key: 'audit_log_retention_days',
        setting_value: '365',
        value_type: 'number',
        description: 'Number of days to retain general audit log entries before purging. Financial/security rows have a longer minimum floor.',
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: require('crypto').randomUUID(),
        setting_key: 'webhook_max_retry_attempts',
        setting_value: '5',
        value_type: 'number',
        description: 'Maximum number of retry attempts for failed outbound webhook deliveries.',
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('platform_settings');
    // Also remove the ENUM type
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_platform_settings_value_type;"
    );
  },
};
