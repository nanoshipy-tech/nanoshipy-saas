'use strict';
const { v4: uuidv4 } = require('uuid');

const NDR_RTO_PERMISSIONS = [
  { key: 'ndr.view', module_name: 'ndr', description: 'View NDR list, details, and summaries' },
  { key: 'ndr.action', module_name: 'ndr', description: 'Perform manual reattempt or address update actions on NDRs' },
  { key: 'rto.view', module_name: 'rto', description: 'View Return-to-Origin lists and details' },
  { key: 'rto.action', module_name: 'rto', description: 'Perform RTO status changes and warehouse receipts' }
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const existingPermissions = await queryInterface.sequelize.query(
      `SELECT key FROM permissions;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingKeys = existingPermissions.map((p) => p.key);

    const newPermissions = NDR_RTO_PERMISSIONS
      .filter((p) => !existingKeys.includes(p.key))
      .map((p) => ({
        id: uuidv4(),
        key: p.key,
        module_name: p.module_name,
        description: p.description,
        created_at: new Date(),
        updated_at: new Date(),
      }));

    if (newPermissions.length > 0) {
      await queryInterface.bulkInsert('permissions', newPermissions);

      // Assign new permissions to the global owner role
      const roles = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'owner' AND tenant_id IS NULL;`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (roles.length > 0) {
        const rolePermissions = newPermissions.map((p) => ({
          role_id: roles[0].id,
          permission_id: p.id,
        }));
        await queryInterface.bulkInsert('role_permissions', rolePermissions);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const keysToDrop = NDR_RTO_PERMISSIONS.map(p => p.key);
    await queryInterface.bulkDelete('permissions', { key: { [Sequelize.Op.in]: keysToDrop } });
  }
};
