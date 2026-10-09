'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Insert default permission keys
    const permissions = [
      { id: uuidv4(), key: 'auth.manage', description: 'Manage authentication settings', module_name: 'auth', created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), key: 'user.manage', description: 'Manage users and roles', module_name: 'users', created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), key: 'settings.manage', description: 'Manage global/tenant settings', module_name: 'settings', created_at: new Date(), updated_at: new Date() },
    ];
    await queryInterface.bulkInsert('permissions', permissions, {});

    // 2. Insert default global roles
    const roles = [
      { id: uuidv4(), tenant_id: null, name: 'owner', is_system_role: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), tenant_id: null, name: 'admin', is_system_role: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), tenant_id: null, name: 'staff', is_system_role: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), tenant_id: null, name: 'support', is_system_role: true, created_at: new Date(), updated_at: new Date() },
    ];
    await queryInterface.bulkInsert('roles', roles, {});

    // 3. Map owner role to all permissions
    const ownerRole = roles.find((r) => r.name === 'owner');
    const rolePermissions = permissions.map((p) => ({
      role_id: ownerRole.id,
      permission_id: p.id,
    }));
    await queryInterface.bulkInsert('role_permissions', rolePermissions, {});
  },

  async down(queryInterface, Sequelize) {
    // Will cascade delete role_permissions
    await queryInterface.bulkDelete('roles', { tenant_id: null }, {});
    await queryInterface.bulkDelete('permissions', {
      key: { [Sequelize.Op.in]: ['auth.manage', 'user.manage', 'settings.manage'] }
    }, {});
  }
};
