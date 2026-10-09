'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('roles', 'is_editable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    
    await queryInterface.addColumn('roles', 'description', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Mark existing 'owner' roles as is_editable = false
    await queryInterface.bulkUpdate(
      'roles',
      { is_editable: false },
      { name: 'owner' }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('roles', 'is_editable');
    await queryInterface.removeColumn('roles', 'description');
  }
};
