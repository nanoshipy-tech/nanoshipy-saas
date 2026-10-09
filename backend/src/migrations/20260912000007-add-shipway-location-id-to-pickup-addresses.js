'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add nullable shipway_location_id column
    await queryInterface.addColumn('pickup_addresses', 'shipway_location_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
      comment: 'Shipway warehouse location ID for multi-warehouse routing',
    });

    // 2. Add composite index for tenant-scoped lookups
    await queryInterface.addIndex('pickup_addresses', ['tenant_id', 'shipway_location_id'], {
      name: 'pickup_addresses_tenant_shipway_loc_idx',
    });

    // 3. Backfill existing default pickup addresses if Shipway provider has a configured warehouse_id
    try {
      const [providers] = await queryInterface.sequelize.query(
        "SELECT config FROM courier_providers WHERE provider_key = 'shipway' LIMIT 1"
      );
      const defaultWhId = providers && providers[0] && providers[0].config && providers[0].config.warehouse_id
        ? String(providers[0].config.warehouse_id)
        : null;

      if (defaultWhId) {
        await queryInterface.sequelize.query(
          `UPDATE pickup_addresses 
           SET shipway_location_id = :defaultWhId 
           WHERE is_default = true AND shipway_location_id IS NULL`,
          { replacements: { defaultWhId } }
        );
      }
    } catch (_e) {
      // Non-fatal if table has no default provider configured yet
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('pickup_addresses', 'pickup_addresses_tenant_shipway_loc_idx');
    await queryInterface.removeColumn('pickup_addresses', 'shipway_location_id');
  },
};
