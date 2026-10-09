'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('tenants');

    if (!tableInfo.kam_id) {
      await queryInterface.addColumn('tenants', 'kam_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_admins',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!tableInfo.state) {
      await queryInterface.addColumn('tenants', 'state', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });

      // Backfill state from primary/first pickup address if available
      try {
        await queryInterface.sequelize.query(`
          UPDATE tenants 
          SET state = (
            SELECT state FROM pickup_addresses 
            WHERE pickup_addresses.tenant_id = tenants.id 
            LIMIT 1
          )
          WHERE state IS NULL;
        `);
      } catch (err) {
        // Safe to ignore in blank environments
      }
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('tenants');
    if (tableInfo.kam_id) {
      await queryInterface.removeColumn('tenants', 'kam_id');
    }
    if (tableInfo.state) {
      await queryInterface.removeColumn('tenants', 'state');
    }
  },
};
