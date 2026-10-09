'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('tenants');
    if (!tableInfo.auto_ndr_on_sandbox) {
      await queryInterface.addColumn('tenants', 'auto_ndr_on_sandbox', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tenants', 'auto_ndr_on_sandbox');
  },
};
