'use strict';

const settingsService = require('../services/settings.service');
const auditService = require('../services/audit.service');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/v1/settings
 * Returns the tenant's effective settings with source metadata.
 */
const getSettings = async (req, res, next) => {
  try {
    const data = await settingsService.getTenantSettings(req.user.tenant_id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/settings
 * Update one or more tenant setting overrides.
 */
const updateSettings = async (req, res, next) => {
  try {
    await settingsService.updateTenantSettings(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    await auditService.log({
      action: 'tenant_settings_updated',
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      entity_type: 'tenant_settings',
      entity_id: req.user.tenant_id,
      metadata: { updated_keys: Object.keys(req.body) },
      req,
    });

    const updated = await settingsService.getTenantSettings(req.user.tenant_id);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

const bcrypt = require('bcrypt');
const { User } = require('../models');

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    
    user.name = name || user.name;
    user.phone = phone || user.phone;
    await user.save();
    
    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: req.user.role
    });
  } catch (err) {
    next(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(400).json({ success: false, error: { message: 'Incorrect current password' } });
    
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(new_password, salt);
    user.token_version = (user.token_version || 1) + 1;
    await user.save();

    // Invalidate all active refresh tokens for immediate revocation
    const { RefreshToken } = require('../models');
    await RefreshToken.destroy({ where: { user_id: user.id } });
    
    return success(res, { message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateProfile,
  updatePassword,
};
