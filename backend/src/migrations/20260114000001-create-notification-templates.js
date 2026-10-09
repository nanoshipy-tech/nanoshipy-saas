'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notification_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      event_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      channel: {
        type: Sequelize.ENUM('email', 'sms', 'whatsapp', 'inapp'),
        allowNull: false,
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      body_template: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      meta_template_name: {
        type: Sequelize.STRING(255),
        allowNull: true, // For WhatsApp pre-approved Meta/BSP templates mapping
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

    await queryInterface.addIndex('notification_templates', ['event_key', 'channel'], {
      unique: true,
      name: 'notification_templates_event_channel_unique_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notification_templates');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_templates_channel";');
  },
};
