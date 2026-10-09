'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      company_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      subdomain: {
        type: Sequelize.STRING(63),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended', 'pending'),
        defaultValue: 'pending',
        allowNull: false,
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: true, // FK to subscription_plans — added in Module 12
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('tenants', ['subdomain'], {
      unique: true,
      name: 'tenants_subdomain_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenants');
  },
};
