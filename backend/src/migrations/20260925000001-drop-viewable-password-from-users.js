'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.viewable_password) {
      await queryInterface.removeColumn('users', 'viewable_password');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    if (!tableInfo.viewable_password) {
      await queryInterface.addColumn('users', 'viewable_password', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },
};
