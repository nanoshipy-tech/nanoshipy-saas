const roleService = require('../../src/services/role.service');
const { ForbiddenError } = require('../../src/services/role.service');

// Mock external dependencies
jest.mock('../../src/repositories/role.repository', () => ({
  findById: jest.fn(),
  countUsersWithRole: jest.fn(),
}));

jest.mock('../../src/repositories/permission.repository', () => ({
  findByKeys: jest.fn(),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn(),
}));

describe('Role Service', () => {
  describe('validatePrivilegeEscalation', () => {
    // We export validatePrivilegeEscalation for testing if needed, or we test createRole/updateRole
    // For now, let's test via createRole
  });

  describe('createRole', () => {
    it('should throw ForbiddenError when user tries to assign permissions they do not have', async () => {
      const data = {
        name: 'Test Role',
        permission_keys: ['user.view', 'user.create']
      };
      
      const req = {
        user: {
          id: 'user123',
          tenant_id: 'tenant123',
          permissions: ['user.view'] // Missing user.create
        }
      };

      await expect(roleService.createRole(data, req)).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when user tries to assign reserved permissions', async () => {
      const data = {
        name: 'Test Role',
        permission_keys: ['courier.manage']
      };
      
      const req = {
        user: {
          id: 'user123',
          tenant_id: 'tenant123',
          permissions: ['courier.manage', 'auth.manage'] // Even if they had it (though they shouldn't)
        }
      };

      await expect(roleService.createRole(data, req)).rejects.toThrow(ForbiddenError);
      await expect(roleService.createRole(data, req)).rejects.toThrow(/reserved for the Platform Admin/);
    });
  });

  describe('deleteRole', () => {
    it('should throw ForbiddenError if role is not editable (system role)', async () => {
      const roleRepo = require('../../src/repositories/role.repository');
      roleRepo.findById.mockResolvedValue({ id: 'role123', is_editable: false });

      const req = { user: { id: 'user123', tenant_id: 'tenant123' } };

      await expect(roleService.deleteRole('role123', req)).rejects.toThrow(ForbiddenError);
      await expect(roleService.deleteRole('role123', req)).rejects.toThrow(/System roles cannot be deleted/);
    });

    it('should throw ConflictError if role has assigned users', async () => {
      const roleRepo = require('../../src/repositories/role.repository');
      roleRepo.findById.mockResolvedValueOnce({ id: 'role123', is_editable: true });
      roleRepo.countUsersWithRole.mockResolvedValueOnce(5);

      const req = { user: { id: 'user123', tenant_id: 'tenant123' } };

      await expect(roleService.deleteRole('role123', req)).rejects.toThrow('Cannot delete a role assigned to active users');
    });
  });
});
