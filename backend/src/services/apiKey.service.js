'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const apiKeyRepository = require('../repositories/apiKey.repository');
const { ApiKey } = require('../models');
const { MaxApiKeysReachedError } = require('../utils/errors');
const { Op } = require('sequelize');

class ApiKeyService {
  /**
   * Hashes a raw API key using SHA-256 (for legacy key fallback)
   */
  hashKeySha256(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Generates a new raw API key
   */
  generateRawKey(sandboxMode = false) {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const prefix = sandboxMode ? 'nspy_test_' : 'nspy_live_';
    return `${prefix}${randomHex}`;
  }

  async createApiKey(tenantId, userId, data) {
    // Enforce max 5 active keys per seller
    const activeKeysCount = await ApiKey.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
        revoked_at: null,
      },
    });

    if (activeKeysCount >= 5) {
      throw new MaxApiKeysReachedError('Maximum limit of 5 active API keys reached. Revoke an existing key first.');
    }

    const sandboxMode = !!data.sandbox_mode;
    const rawKey = this.generateRawKey(sandboxMode);
    
    // Hash using bcrypt per SOW specification
    const keyHash = await bcrypt.hash(rawKey, 10);
    
    // Prefix is first 12 chars: 'nspy_live_xx' or 'nspy_test_xx'
    const keyPrefix = rawKey.substring(0, 12);

    const label = data.label || data.name || 'API Key';
    const finalScopes = data.scope ? [data.scope] : (data.scopes || ['read_only']);

    const apiKey = await ApiKey.create({
      tenant_id: tenantId,
      name: label, // Map name to label for compatibility
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: finalScopes,
      sandbox_mode: sandboxMode,
      expires_at: data.expires_at || null,
      created_by: userId,
      is_active: true,
    });

    return {
      apiKey,
      rawKey,
    };
  }

  async listApiKeys(tenantId, options = {}) {
    return ApiKey.findAndCountAll({
      where: {
        tenant_id: tenantId,
        is_active: true,
        revoked_at: null,
      },
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async revokeApiKey(id, tenantId) {
    const key = await ApiKey.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!key) return null;

    return key.update({
      is_active: false,
      revoked_at: new Date(),
    });
  }

  async verifyAndGetApiKey(rawKey) {
    if (!rawKey) return null;
    
    const prefix = rawKey.substring(0, 12);

    // Look up active keys with this prefix
    const candidates = await ApiKey.findAll({
      where: {
        key_prefix: prefix,
        is_active: true,
        revoked_at: null,
      },
    });

    for (const key of candidates) {
      // 1. Try bcrypt match (new keys)
      try {
        const isMatch = await bcrypt.compare(rawKey, key.key_hash);
        if (isMatch) {
          if (key.expires_at && new Date() > new Date(key.expires_at)) {
            return null;
          }
          return key;
        }
      } catch (err) {
        // Fallback to SHA-256 for legacy keys
        const legacyHash = this.hashKeySha256(rawKey);
        if (legacyHash === key.key_hash) {
          if (key.expires_at && new Date() > new Date(key.expires_at)) {
            return null;
          }
          return key;
        }
      }
    }

    // Fallback lookup if prefix doesn't match standard (legacy keys)
    const sha256Hash = this.hashKeySha256(rawKey);
    const legacyKey = await ApiKey.findOne({
      where: {
        key_hash: sha256Hash,
        is_active: true,
        revoked_at: null,
      },
    });

    if (legacyKey) {
      if (legacyKey.expires_at && new Date() > new Date(legacyKey.expires_at)) {
        return null;
      }
      return legacyKey;
    }

    return null;
  }

  async updateLastUsed(id, tenantId) {
    const key = await ApiKey.findOne({ where: { id, tenant_id: tenantId } });
    if (key) {
      await key.update({ last_used_at: new Date() });
    }
  }
}

module.exports = new ApiKeyService();
