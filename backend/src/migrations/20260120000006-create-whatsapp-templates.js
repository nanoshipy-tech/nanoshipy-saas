'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('whatsapp_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      category: {
        type: Sequelize.ENUM('utility', 'authentication', 'marketing'),
        allowNull: false,
      },
      language: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'en',
      },
      header_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      body_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      footer_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      buttons: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      bsp_template_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      meta_approval_status: {
        type: Sequelize.ENUM('draft', 'submitted', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'draft',
      },
      meta_rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'platform_admins',
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
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('whatsapp_templates', ['name'], {
      unique: true,
      name: 'whatsapp_templates_name_unique_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('whatsapp_templates');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_whatsapp_templates_category";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_whatsapp_templates_meta_approval_status";');
  },
};
