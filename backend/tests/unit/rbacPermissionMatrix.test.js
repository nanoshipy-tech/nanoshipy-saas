'use strict';

const can = require('../../src/middlewares/can.middleware');
const { canPlatform } = require('../../src/middlewares/canPlatform.middleware');

describe('RBAC & Permission Boundaries Test Matrix', () => {
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  describe('Merchant can.middleware checks', () => {
    it('1. Rejects unauthenticated requests with 401', () => {
      const req = { user: null };
      const middleware = can('order.create');

      middleware(req, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('2. Tenant Owner / Admin bypasses tenant-level granular checks', () => {
      const reqOwner = { user: { id: 'u-1', tenant_id: 't-1', role: 'owner', permissions: [] } };
      const reqAdmin = { user: { id: 'u-2', tenant_id: 't-1', role: 'admin', permissions: [] } };

      can('order.create')(reqOwner, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);

      can('billing.manage')(reqAdmin, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(2);
    });

    it('3. Sub-user with exact permission is allowed', () => {
      const req = {
        user: {
          id: 'u-sub',
          tenant_id: 't-1',
          role: 'sub_user',
          permissions: ['order.create', 'order.view'],
        },
      };

      can('order.create')(req, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('4. Sub-user with domain wildcard is allowed for matching domain only', () => {
      const req = {
        user: {
          id: 'u-sub',
          tenant_id: 't-1',
          role: 'sub_user',
          permissions: ['order.*'],
        },
      };

      // Allowed for order domain
      can('order.delete')(req, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);

      // Blocked for billing domain
      can('billing.view')(req, mockRes, nextFn);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'Access denied. Requires permission: billing.view',
          }),
        })
      );
    });

    it('5. Sub-user without required permission is rejected with 403', () => {
      const req = {
        user: {
          id: 'u-sub',
          tenant_id: 't-1',
          role: 'sub_user',
          permissions: ['order.view'],
        },
      };

      can('ndr.action')(req, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'Access denied. Requires permission: ndr.action',
          }),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('6. Request parameter tampering cannot escalate permissions', () => {
      // Attacker attempts to pass permissions in body/params
      const req = {
        user: {
          id: 'u-sub',
          tenant_id: 't-1',
          role: 'sub_user',
          permissions: ['order.view'],
        },
        body: { role: 'admin', permissions: ['*'] },
        params: { role: 'super_admin' },
      };

      can('billing.manage')(req, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Platform Admin canPlatform.middleware checks', () => {
    it('7. Rejects missing platform admin context with 401', () => {
      const req = { platformAdmin: null };
      const middleware = canPlatform('system.manage');

      middleware(req, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('8. Allows platform admin with required platform permission', () => {
      const req = {
        platformAdmin: {
          id: 'p-admin',
          role: 'platform_ops',
          permissions: ['courier.manage', 'report.view'],
        },
      };

      canPlatform('courier.manage')(req, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('9. Rejects platform admin lacking required platform permission with 403', () => {
      const req = {
        platformAdmin: {
          id: 'p-admin',
          role: 'support_agent',
          permissions: ['ticket.view'],
        },
      };

      canPlatform('platform.billing.manage')(req, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });
});
