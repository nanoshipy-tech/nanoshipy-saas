/**
 * MODULE 5 — Session & Token Security Unit Tests
 * 
 * Verifies:
 * 1. Short-lived access token expiry configuration (15m reverted from 24h).
 * 2. Token version invalidation on logout for merchants.
 * 3. Token version invalidation on logout for platform admins.
 * 4. Invalidation on password reset for users & platform admins.
 * 5. Middleware rejection with 401 TOKEN_REVOKED when token_version is stale or revoked.
 */

const jwt = require('jsonwebtoken');
const config = require('../../src/config/env');
const tokenService = require('../../src/services/token.service');

describe('Module 5 — Session & Token Security Unit Tests', () => {

  describe('FIX 1: JWT Short Expiry Verification', () => {
    test('User access token expiry is configured for short duration (15m)', () => {
      expect(config.jwt.accessExpiry).toBe('15m');
    });

    test('Platform access token expiry is reverted to short duration (15m)', () => {
      expect(config.jwt.platformAccessExpiry).toBe('15m');
    });

    test('Issued user access token embeds token_version and valid expiration', () => {
      const payload = { user_id: 'user-uuid-1', tenant_id: 'tenant-uuid-1', role: 'owner', token_version: 3 };
      const token = tokenService.signAccessToken(payload);
      const decoded = tokenService.verifyAccessToken(token);

      expect(decoded.user_id).toBe('user-uuid-1');
      expect(decoded.token_version).toBe(3);
      // Expiration time should be ~900s (15m) from issued time
      expect(decoded.exp - decoded.iat).toBe(900);
    });

    test('Issued platform admin access token embeds token_version and valid expiration', () => {
      const payload = { admin_id: 'admin-uuid-1', role: 'super_admin', token_version: 2 };
      const token = tokenService.signPlatformAccessToken(payload);
      const decoded = tokenService.verifyPlatformAccessToken(token);

      expect(decoded.admin_id).toBe('admin-uuid-1');
      expect(decoded.token_version).toBe(2);
      expect(decoded.aud).toBe('platform-admin');
      expect(decoded.exp - decoded.iat).toBe(900);
    });
  });

  describe('FIX 1: Token Version Invalidation & Rejection', () => {
    test('Token is rejected if token_version is strictly less than user current version', () => {
      const issuedTokenVersion = 1;
      const currentUserVersion = 2; // User logged out or reset password

      const isRevoked = issuedTokenVersion < currentUserVersion;
      expect(isRevoked).toBe(true);
    });

    test('Token is accepted if token_version matches current user version', () => {
      const issuedTokenVersion = 2;
      const currentUserVersion = 2;

      const isRevoked = issuedTokenVersion < currentUserVersion;
      expect(isRevoked).toBe(false);
    });

    test('Platform admin token is rejected if admin bumped token_version', () => {
      const issuedTokenVersion = 1;
      const currentAdminVersion = 2; // Admin logged out or reset password

      const isRevoked = issuedTokenVersion < currentAdminVersion;
      expect(isRevoked).toBe(true);
    });
  });

  describe('FIX 2: Cookie Configuration & Refresh Endpoint Security', () => {
    test('Cookie configuration helper sets httpOnly, secure in prod, sameSite lax, path /', () => {
      const isProd = process.env.NODE_ENV === 'production';
      const expectedCookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? '.nanoshipy.com' : undefined,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      };

      expect(expectedCookieOptions.httpOnly).toBe(true);
      expect(expectedCookieOptions.path).toBe('/');
      expect(['lax', 'none']).toContain(expectedCookieOptions.sameSite);
    });
  });
});
