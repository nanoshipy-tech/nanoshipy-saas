'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notification_logs', {
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
      event_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      channel: {
        type: Sequelize.ENUM('email', 'sms', 'whatsapp', 'inapp'),
        allowNull: false,
      },
      recipient: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'delivered', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      provider_response: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('notification_logs', ['tenant_id', 'created_at'], {
      name: 'notification_logs_tenant_created_idx',
    });

    await queryInterface.addIndex('notification_logs', ['status'], {
      name: 'notification_logs_status_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notification_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_logs_channel";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_logs_status";');
  },
};
