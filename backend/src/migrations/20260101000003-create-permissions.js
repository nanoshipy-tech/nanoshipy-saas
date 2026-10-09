'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true, // e.g. 'order.create', 'user.manage'
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      module_name: {
        type: Sequelize.STRING(50),
        allowNull: true, // e.g. 'auth', 'orders', 'settings'
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

    await queryInterface.addIndex('permissions', ['key'], {
      unique: true,
      name: 'permissions_key_unique',
    });

    await queryInterface.addIndex('permissions', ['module_name'], {
      name: 'permissions_module_name_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('permissions');
  },
};
