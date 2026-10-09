'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create pincode_master table
    await queryInterface.createTable('pincode_master', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      pincode: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true,
      },
      district: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_serviceable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('seed', 'manual', 'api', 'bulk_upload'),
        defaultValue: 'seed',
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('pincode_master', ['pincode'], { unique: true });
    await queryInterface.addIndex('pincode_master', ['state']);

    // 2. Create address_lookup_audit_logs table
    await queryInterface.createTable('address_lookup_audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tenants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      pincode_searched: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      lookup_source: {
        type: Sequelize.ENUM('pincode_master', 'google', 'none'),
        defaultValue: 'none',
        allowNull: false,
      },
      success: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      error_reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('address_lookup_audit_logs', ['pincode_searched']);
    await queryInterface.addIndex('address_lookup_audit_logs', ['created_at']);

    // 3. Add address_source & pincode_verified to orders table (nullable)
    await queryInterface.addColumn('orders', 'address_source', {
      type: Sequelize.ENUM('manual', 'pincode_lookup', 'google_autocomplete'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('orders', 'pincode_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // 4. Add address_source & pincode_verified to pickup_addresses table (nullable)
    await queryInterface.addColumn('pickup_addresses', 'address_source', {
      type: Sequelize.ENUM('manual', 'pincode_lookup', 'google_autocomplete'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('pickup_addresses', 'pincode_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('pickup_addresses', 'pincode_verified');
    await queryInterface.removeColumn('pickup_addresses', 'address_source');
    await queryInterface.removeColumn('orders', 'pincode_verified');
    await queryInterface.removeColumn('orders', 'address_source');
    await queryInterface.dropTable('address_lookup_audit_logs');
    await queryInterface.dropTable('pincode_master');
  },
};
