'use strict';
const { v4: uuidv4 } = require('uuid');
const { PERMISSIONS } = require('../constants/permissions.constant');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. We might have some permissions already seeded from module 1 (like auth.manage)
    // We should safely upsert or insert them if they don't exist.
    // Easiest is to fetch existing, and insert missing ones.
    
    const existingPermissions = await queryInterface.sequelize.query(
      `SELECT key FROM permissions;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingKeys = existingPermissions.map((p) => p.key);

    const newPermissions = PERMISSIONS
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

    // Now, update the existing permissions with description/module_name just in case they were blank
    for (const p of PERMISSIONS) {
      await queryInterface.bulkUpdate(
        'permissions',
        { module_name: p.module_name, description: p.description },
        { key: p.key }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    const keysToDrop = PERMISSIONS.map(p => p.key);
    await queryInterface.bulkDelete('permissions', { key: { [Sequelize.Op.in]: keysToDrop } });
  }
};
