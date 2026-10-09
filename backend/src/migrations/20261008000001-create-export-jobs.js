'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.createTable('export_jobs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        requested_by: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        entity: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        filters: {
          type: Sequelize.JSON,
          defaultValue: {},
        },
        columns: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING(30),
          defaultValue: 'queued',
          allowNull: false,
        },
        total_rows: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        file_key: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        file_size: {
          type: Sequelize.BIGINT,
          defaultValue: 0,
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    } catch (_) {}

    await queryInterface.addIndex('export_jobs', ['tenant_id', 'status', 'created_at'], {
      name: 'idx_export_jobs_tenant_status_created',
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('export_jobs');
  },
};
