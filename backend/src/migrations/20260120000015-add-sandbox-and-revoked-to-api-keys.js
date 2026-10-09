'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('api_keys');

    if (!tableInfo.sandbox_mode) {
      await queryInterface.addColumn('api_keys', 'sandbox_mode', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
    if (!tableInfo.revoked_at) {
      await queryInterface.addColumn('api_keys', 'revoked_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('api_keys', 'sandbox_mode');
    await queryInterface.removeColumn('api_keys', 'revoked_at');
  },
};
