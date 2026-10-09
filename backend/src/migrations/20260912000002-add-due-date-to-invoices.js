'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('invoices');

    if (!tableInfo.due_date) {
      await queryInterface.addColumn('invoices', 'due_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });

      // Backfill existing invoices due_date to created_at + 15 days if null
      try {
        const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
        if (isSqlite) {
          await queryInterface.sequelize.query(`
            UPDATE invoices 
            SET due_date = date(created_at, '+15 days')
            WHERE due_date IS NULL;
          `);
        } else {
          await queryInterface.sequelize.query(`
            UPDATE invoices 
            SET due_date = (created_at + INTERVAL '15 days')::date
            WHERE due_date IS NULL;
          `);
        }
      } catch (err) {
        // Safe to ignore if table empty
      }
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('invoices');
    if (tableInfo.due_date) {
      await queryInterface.removeColumn('invoices', 'due_date');
    }
  },
};
