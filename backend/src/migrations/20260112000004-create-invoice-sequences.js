'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_sequences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      series_key: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      last_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique Constraint Index
    await queryInterface.addIndex('invoice_sequences', ['financial_year', 'series_key'], {
      unique: true,
      name: 'invoice_sequences_fy_key_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invoice_sequences');
  },
};
