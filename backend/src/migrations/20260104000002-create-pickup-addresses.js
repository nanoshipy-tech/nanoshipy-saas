'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pickup_addresses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      contact_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      address_line1: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      pincode: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING(100),
        defaultValue: 'India',
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      verification_status: {
        type: Sequelize.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
      }
    });

    await queryInterface.addIndex('pickup_addresses', ['tenant_id', 'is_active'], {
      name: 'pickup_addresses_tenant_active_idx',
    });
    
    await queryInterface.addIndex('pickup_addresses', ['tenant_id', 'is_default'], {
      name: 'pickup_addresses_tenant_default_idx',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pickup_addresses');
  }
};
