'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      balance: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      low_balance_threshold: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 500.00,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Populate wallets for existing tenants
    const tenants = await queryInterface.sequelize.query(
      `SELECT id FROM tenants;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const { v4: uuidv4 } = require('uuid');
    if (tenants.length > 0) {
      const walletsToCreate = tenants.map((t) => ({
        id: uuidv4(),
        tenant_id: t.id,
        balance: 0.00,
        low_balance_threshold: 500.00,
        currency: 'INR',
        created_at: new Date(),
        updated_at: new Date(),
      }));
      await queryInterface.bulkInsert('wallets', walletsToCreate);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wallets');
  },
};
