const jwt = require('jsonwebtoken');
const config = require('../config/env');
const hashUtils = require('../utils/hash');
const refreshTokenRepo = require('../repositories/refreshToken.repository');
const { PlatformRefreshToken } = require('../models');
const { AuthenticationError } = require('../utils/errors');

const signAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, token_version: payload.token_version || 1 },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiry }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

const signPlatformAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, token_version: payload.token_version || 1, aud: 'platform-admin' },
    config.jwt.platformAccessSecret,
    { expiresIn: config.jwt.platformAccessExpiry }
  );
};

const verifyPlatformAccessToken = (token) => {
  return jwt.verify(token, config.jwt.platformAccessSecret, { audience: 'platform-admin' });
};

const signImpersonationToken = (payload) => {
  // Impersonation token uses the regular tenant access secret but carries the impersonated claims
  return jwt.sign({ ...payload, impersonated: true }, config.jwt.accessSecret, {
    expiresIn: config.jwt.platformImpersonationExpiry,
  });
};

const signEmailVerificationToken = (payload) => {
  // Use access secret but maybe with a different expiry (e.g. 24h)
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: '24h',
  });
};

const verifyEmailVerificationToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

const generateRefreshToken = async (userId, deviceInfo, ipAddress) => {
  const token = hashUtils.generateOpaqueToken();
  const tokenHash = hashUtils.sha256(token);
  
  // Parse '30d' into actual date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await refreshTokenRepo.create({
    user_id: userId,
    token_hash: tokenHash,
    device_info: deviceInfo,
    ip_address: ipAddress,
    expires_at: expiresAt,
  });

  return token;
};

const generatePlatformRefreshToken = async (adminId, deviceInfo, ipAddress) => {
  const token = hashUtils.generateOpaqueToken();
  const tokenHash = hashUtils.sha256(token);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Platform uses 7 days

  await PlatformRefreshToken.create({
    admin_id: adminId,
    token_hash: tokenHash,
    device_info: deviceInfo,
    ip_address: ipAddress,
    expires_at: expiresAt,
  });

  return token;
};

const rotateRefreshToken = async (oldToken, deviceInfo, ipAddress) => {
  const tokenHash = hashUtils.sha256(oldToken);
  const existingRecord = await refreshTokenRepo.findByHash(tokenHash);

  if (!existingRecord) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Grace window: if this token was revoked very recently (within 15 seconds),
  // it's likely a concurrent call (React StrictMode double-mount, multiple tabs, background polling, etc.)
  // Rather than nuking all sessions, find and return the replacement token.
  if (existingRecord.revoked_at) {
    const revokedMs = Date.now() - new Date(existingRecord.revoked_at).getTime();
    if (revokedMs < 15000) {
      const { RefreshToken } = require('../models');
      const replacement = await RefreshToken.findOne({
        where: {
          user_id: existingRecord.user_id,
          revoked_at: null,
        },
        order: [['created_at', 'DESC']],
      });
      if (replacement) {
        return { newToken: null, userId: existingRecord.user_id, __reuseReplacement: true };
      }
    }

    // Breach detection: token is already revoked beyond grace window, someone is trying to use it again.
    // Revoke all tokens for this user (family revocation)
    await refreshTokenRepo.revokeFamily(existingRecord.user_id);
    throw new AuthenticationError('Refresh token reuse detected. All sessions revoked.');
  }

  if (new Date() > existingRecord.expires_at) {
    throw new AuthenticationError('Refresh token expired');
  }

  // Revoke the old token
  await refreshTokenRepo.revoke(existingRecord.id);

  // Generate a new one
  const newToken = await generateRefreshToken(existingRecord.user_id, deviceInfo, ipAddress);
  
  return { newToken, userId: existingRecord.user_id };
};

const rotatePlatformRefreshToken = async (oldToken, deviceInfo, ipAddress) => {
  const tokenHash = hashUtils.sha256(oldToken);
  const existingRecord = await PlatformRefreshToken.findOne({ where: { token_hash: tokenHash } });

  if (!existingRecord) {
    throw new AuthenticationError('Invalid refresh token');
  }

  if (existingRecord.revoked_at) {
    // Grace window: if this token was revoked very recently (within 15 seconds),
    // it's likely a concurrent call (React StrictMode double-mount, tab restore, etc.)
    // Rather than nuking all sessions, find and return the replacement token.
    const revokedMs = Date.now() - new Date(existingRecord.revoked_at).getTime();
    if (revokedMs < 15000) {
      // Find the newest valid token for this admin issued after the revocation
      const replacement = await PlatformRefreshToken.findOne({
        where: {
          admin_id: existingRecord.admin_id,
          revoked_at: null,
        },
        order: [['created_at', 'DESC']],
      });
      if (replacement) {
        // Return the already-issued replacement as the "new" token
        // We don't rotate again — the next call with the replacement token will do so
        return { newToken: null, adminId: existingRecord.admin_id, __reuseReplacement: true };
      }
    }

    // Token reuse outside grace window — genuine replay attack. Revoke all sessions.
    await PlatformRefreshToken.update(
      { revoked_at: new Date() },
      { where: { admin_id: existingRecord.admin_id, revoked_at: null } }
    );
    throw new AuthenticationError('Refresh token reuse detected. All sessions revoked.');
  }

  if (new Date() > existingRecord.expires_at) {
    throw new AuthenticationError('Refresh token expired');
  }

  existingRecord.revoked_at = new Date();
  await existingRecord.save();

  const newToken = await generatePlatformRefreshToken(existingRecord.admin_id, deviceInfo, ipAddress);
  
  return { newToken, adminId: existingRecord.admin_id };
};

const revokeRefreshToken = async (token) => {
  if (!token) return;
  const tokenHash = hashUtils.sha256(token);
  const existingRecord = await refreshTokenRepo.findByHash(tokenHash);
  if (existingRecord && !existingRecord.revoked_at) {
    await refreshTokenRepo.revoke(existingRecord.id);
  }
};

const revokePlatformRefreshToken = async (token) => {
  if (!token) return;
  const tokenHash = hashUtils.sha256(token);
  const existingRecord = await PlatformRefreshToken.findOne({ where: { token_hash: tokenHash } });
  if (existingRecord && !existingRecord.revoked_at) {
    existingRecord.revoked_at = new Date();
    await existingRecord.save();
  }
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signEmailVerificationToken,
  verifyEmailVerificationToken,
  generateRefreshToken,
  generatePlatformRefreshToken,
  rotateRefreshToken,
  rotatePlatformRefreshToken,
  revokeRefreshToken,
  revokePlatformRefreshToken,
  signPlatformAccessToken,
  verifyPlatformAccessToken,
  signImpersonationToken,
};
