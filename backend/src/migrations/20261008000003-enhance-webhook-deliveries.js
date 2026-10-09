'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('webhook_deliveries').catch(() => ({}));

    if (!tableDesc.endpoint_id) {
      await queryInterface.addColumn('webhook_deliveries', 'endpoint_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!tableDesc.tenant_id) {
      await queryInterface.addColumn('webhook_deliveries', 'tenant_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!tableDesc.event) {
      await queryInterface.addColumn('webhook_deliveries', 'event', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!tableDesc.event_id) {
      await queryInterface.addColumn('webhook_deliveries', 'event_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!tableDesc.attempts) {
      await queryInterface.addColumn('webhook_deliveries', 'attempts', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
    }

    if (!tableDesc.next_retry_at) {
      await queryInterface.addColumn('webhook_deliveries', 'next_retry_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!tableDesc.last_error) {
      await queryInterface.addColumn('webhook_deliveries', 'last_error', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('webhook_deliveries').catch(() => ({}));
    if (tableDesc.endpoint_id) await queryInterface.removeColumn('webhook_deliveries', 'endpoint_id');
    if (tableDesc.tenant_id) await queryInterface.removeColumn('webhook_deliveries', 'tenant_id');
    if (tableDesc.event) await queryInterface.removeColumn('webhook_deliveries', 'event');
    if (tableDesc.event_id) await queryInterface.removeColumn('webhook_deliveries', 'event_id');
    if (tableDesc.attempts) await queryInterface.removeColumn('webhook_deliveries', 'attempts');
    if (tableDesc.next_retry_at) await queryInterface.removeColumn('webhook_deliveries', 'next_retry_at');
    if (tableDesc.last_error) await queryInterface.removeColumn('webhook_deliveries', 'last_error');
  },
};
