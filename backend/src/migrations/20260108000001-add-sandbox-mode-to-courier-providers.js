'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('courier_providers', 'sandbox_mode', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    
    await queryInterface.addColumn('courier_providers', 'circuit_breaker_state', {
      type: Sequelize.ENUM('closed', 'open', 'half_open'),
      allowNull: false,
      defaultValue: 'closed',
    });
    
    await queryInterface.addColumn('courier_providers', 'circuit_breaker_opened_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    
    await queryInterface.addColumn('courier_providers', 'consecutive_failures', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('courier_providers', 'sandbox_mode');
    await queryInterface.removeColumn('courier_providers', 'circuit_breaker_state');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_courier_providers_circuit_breaker_state";');
    await queryInterface.removeColumn('courier_providers', 'circuit_breaker_opened_at');
    await queryInterface.removeColumn('courier_providers', 'consecutive_failures');
  }
};
