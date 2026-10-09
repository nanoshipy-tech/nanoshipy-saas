'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('wallet_transactions');
    if (tableInfo.reference_type) {
      // 1. Drop default constraint if any
      try {
        await queryInterface.sequelize.query('ALTER TABLE wallet_transactions ALTER COLUMN reference_type DROP DEFAULT;');
      } catch (err) {}
      // 2. Cast column to VARCHAR(50)
      await queryInterface.sequelize.query('ALTER TABLE wallet_transactions ALTER COLUMN reference_type TYPE VARCHAR(50) USING reference_type::varchar;');
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverting to ENUM is not strictly necessary for rollbacks of VARCHAR fields
  },
};
