'use strict';
const { v4: uuidv4 } = require('uuid');
const { PLATFORM_PERMISSIONS, PLATFORM_ROLES } = require('../constants/platformPermissions.constant');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Seed Permissions
    const newPermissions = PLATFORM_PERMISSIONS.map((p) => ({
      id: uuidv4(),
      key: p.key,
      module_name: p.module_name,
      description: p.description,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('platform_permissions', newPermissions);

    // 2. Map Permissions to Roles
    const rolePermissionsData = [];
    
    // Create a key -> id map for fast lookup
    const permMap = newPermissions.reduce((acc, p) => {
      acc[p.key] = p.id;
      return acc;
    }, {});

    for (const [role, keys] of Object.entries(PLATFORM_ROLES)) {
      for (const key of keys) {
        if (permMap[key]) {
          rolePermissionsData.push({
            role,
            permission_id: permMap[key],
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }
    }

    if (rolePermissionsData.length > 0) {
      await queryInterface.bulkInsert('platform_role_permissions', rolePermissionsData);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('platform_role_permissions', null, {});
    const keysToDrop = PLATFORM_PERMISSIONS.map(p => p.key);
    await queryInterface.bulkDelete('platform_permissions', { key: { [Sequelize.Op.in]: keysToDrop } });
  }
};
