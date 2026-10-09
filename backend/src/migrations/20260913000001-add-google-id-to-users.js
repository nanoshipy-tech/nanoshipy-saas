'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.google_id) {
      await queryInterface.addColumn('users', 'google_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
      await queryInterface.addIndex('users', ['google_id'], {
        name: 'idx_users_google_id',
      });
    }

    if (!tableInfo.avatar_url) {
      await queryInterface.addColumn('users', 'avatar_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.google_id) {
      await queryInterface.removeIndex('users', 'idx_users_google_id');
      await queryInterface.removeColumn('users', 'google_id');
    }
    if (tableInfo.avatar_url) {
      await queryInterface.removeColumn('users', 'avatar_url');
    }
  },
};
