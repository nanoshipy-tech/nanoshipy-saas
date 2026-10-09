'use strict';

const bcrypt = require('bcrypt');

describe('Merchant Password Change Session Invalidation Unit Test (#17)', () => {
  it('should increment token_version and destroy active refresh tokens upon password update', async () => {
    const mockUser = {
      id: 'user-xyz-123',
      password_hash: await bcrypt.hash('OldPassword@123', 10),
      token_version: 2,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockRefreshTokenDestroy = jest.fn().mockResolvedValue(3);

    jest.doMock('../../src/models', () => ({
      User: {
        scope: jest.fn().mockReturnValue({
          findByPk: jest.fn().mockResolvedValue(mockUser),
        }),
      },
      RefreshToken: {
        destroy: mockRefreshTokenDestroy,
      },
      TenantSetting: {},
    }));

    const { updatePassword } = require('../../src/controllers/tenantSettings.controller');

    const req = {
      user: { id: 'user-xyz-123' },
      body: {
        current_password: 'OldPassword@123',
        new_password: 'NewStrongPassword@2026',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await updatePassword(req, res, next);

    expect(mockUser.token_version).toBe(3);
    expect(mockUser.save).toHaveBeenCalled();
    expect(mockRefreshTokenDestroy).toHaveBeenCalledWith({
      where: { user_id: 'user-xyz-123' },
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { message: 'Password updated successfully' },
      })
    );
  });
});
