'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Index on tenants.kam_id for KAM assignment queries and platform filtering
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_kam_id ON tenants (kam_id);
    `);

    // 2. Index on orders.shipping_pincode for pincode-based order routing and lookups
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_shipping_pincode ON orders (shipping_pincode);
    `);

    // 3. Composite index on orders(tenant_id, created_at) for pagination and sorting
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders (tenant_id, created_at DESC);
    `);

    // 4. Composite index on orders(tenant_id, status) for tab filtering in seller/admin panels
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders (tenant_id, status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_orders_tenant_status;
      DROP INDEX IF EXISTS idx_orders_tenant_created;
      DROP INDEX IF EXISTS idx_orders_shipping_pincode;
      DROP INDEX IF EXISTS idx_tenants_kam_id;
    `);
  },
};
