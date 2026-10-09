const tokenService = require('../../src/services/token.service');
const refreshTokenRepo = require('../../src/repositories/refreshToken.repository');
const { RefreshToken } = require('../../src/models');
const hashUtils = require('../../src/utils/hash');
const { AuthenticationError } = require('../../src/utils/errors');

jest.mock('../../src/repositories/refreshToken.repository');
jest.mock('../../src/models');
jest.mock('../../src/utils/hash');

describe('Token Service - rotateRefreshToken Grace Period', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rotates an active valid refresh token normally', async () => {
    const oldToken = 'valid-refresh-token';
    const fakeHash = 'hash-123';
    hashUtils.sha256.mockReturnValue(fakeHash);
    hashUtils.generateOpaqueToken.mockReturnValue('new-opaque-token');

    const record = {
      id: 'token-id-1',
      user_id: 'user-id-1',
      revoked_at: null,
      expires_at: new Date(Date.now() + 86400000),
    };
    refreshTokenRepo.findByHash.mockResolvedValue(record);
    refreshTokenRepo.revoke.mockResolvedValue([1]);
    refreshTokenRepo.create.mockResolvedValue({});

    const result = await tokenService.rotateRefreshToken(oldToken, 'test-device', '127.0.0.1');
    expect(result.userId).toBe('user-id-1');
    expect(result.newToken).toBeDefined();
    expect(refreshTokenRepo.revoke).toHaveBeenCalledWith('token-id-1');
  });

  it('allows concurrent requests within the 15-second grace window without revoking family', async () => {
    const oldToken = 'recently-revoked-token';
    const fakeHash = 'hash-456';
    hashUtils.sha256.mockReturnValue(fakeHash);

    // Revoked 2 seconds ago (within grace window)
    const record = {
      id: 'token-id-1',
      user_id: 'user-id-1',
      revoked_at: new Date(Date.now() - 2000),
      expires_at: new Date(Date.now() + 86400000),
    };
    refreshTokenRepo.findByHash.mockResolvedValue(record);

    const replacementRecord = {
      id: 'token-id-2',
      user_id: 'user-id-1',
      revoked_at: null,
      expires_at: new Date(Date.now() + 86400000),
    };
    RefreshToken.findOne.mockResolvedValue(replacementRecord);

    const result = await tokenService.rotateRefreshToken(oldToken, 'test-device', '127.0.0.1');
    expect(result.userId).toBe('user-id-1');
    expect(result.__reuseReplacement).toBe(true);
    expect(result.newToken).toBeNull();
    expect(refreshTokenRepo.revokeFamily).not.toHaveBeenCalled();
  });

  it('triggers family revocation when token was revoked beyond the grace window (>15s)', async () => {
    const oldToken = 'old-stolen-token';
    const fakeHash = 'hash-789';
    hashUtils.sha256.mockReturnValue(fakeHash);

    // Revoked 60 seconds ago (beyond grace window)
    const record = {
      id: 'token-id-1',
      user_id: 'user-id-1',
      revoked_at: new Date(Date.now() - 60000),
      expires_at: new Date(Date.now() + 86400000),
    };
    refreshTokenRepo.findByHash.mockResolvedValue(record);

    await expect(
      tokenService.rotateRefreshToken(oldToken, 'test-device', '127.0.0.1')
    ).rejects.toThrow('Refresh token reuse detected. All sessions revoked.');

    expect(refreshTokenRepo.revokeFamily).toHaveBeenCalledWith('user-id-1');
  });
});
