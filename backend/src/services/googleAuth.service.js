'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { Op } = require('sequelize');
const {
  sequelize, User, Tenant, Wallet, CourierProvider,
  TenantCourierAccess, PlatformSetting
} = require('../models');
const tenantRepository = require('../repositories/tenant.repository');
const subscriptionPlanService = require('./subscriptionPlan.service');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const hashUtils = require('../utils/hash');
const logger = require('../utils/logger');
const config = require('../config/env');

class GoogleAuthError extends Error {
  constructor(message, code = 'GOOGLE_AUTH_ERROR') {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

/**
 * Fetch Google OAuth configuration from PlatformSetting (with fallback to env)
 */
async function getGoogleConfig() {
  try {
    const settings = await PlatformSetting.findAll({
      where: {
        setting_key: {
          [Op.in]: ['google_auth_enabled', 'google_client_id', 'google_client_secret'],
        },
      },
    });

    const map = {};
    settings.forEach((s) => {
      map[s.setting_key] = s.setting_value;
    });

    const enabled = map['google_auth_enabled'] !== undefined
      ? map['google_auth_enabled'] === 'true'
      : (process.env.GOOGLE_AUTH_ENABLED === 'true');

    const clientId = map['google_client_id'] || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = map['google_client_secret'] || process.env.GOOGLE_CLIENT_SECRET || '';

    return {
      enabled,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    };
  } catch (err) {
    logger.warn(`[GoogleAuthService] Failed to read settings from DB: ${err.message}`);
    return {
      enabled: process.env.GOOGLE_AUTH_ENABLED === 'true',
      clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    };
  }
}

/**
 * Verify Google ID Token (from Google Identity Services / One-Tap / GIS popup)
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new GoogleAuthError('Google ID token is required', 'MISSING_TOKEN');
  }

  const gConfig = await getGoogleConfig();

  try {
    const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { id_token: idToken },
      timeout: 6000,
    });

    const payload = response.data;
    if (!payload || !payload.sub || !payload.email) {
      throw new GoogleAuthError('Invalid Google credential payload', 'INVALID_PAYLOAD');
    }

    // Verify audience matches configured client ID if client ID is set
    if (gConfig.clientId && payload.aud && payload.aud !== gConfig.clientId) {
      logger.warn(`[GoogleAuthService] Token audience mismatch: token aud is ${payload.aud}, configured is ${gConfig.clientId}`);
      // If environment or database has a different client ID, accept if audience ends with googleusercontent.com
      if (!payload.aud.includes('.apps.googleusercontent.com')) {
        throw new GoogleAuthError('Google Client ID mismatch', 'AUD_MISMATCH');
      }
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.given_name || 'Google User',
      picture: payload.picture || null,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
  } catch (err) {
    logger.error(`[GoogleAuthService] Token verification failed: ${err.message}`);
    throw new GoogleAuthError(
      err.response?.data?.error_description || err.message || 'Google token validation failed',
      'TOKEN_VERIFICATION_FAILED'
    );
  }
}

/**
 * Exchange OAuth2 Authorization Code for Google User Profile
 */
async function exchangeGoogleAuthCode(code, redirectUri) {
  const gConfig = await getGoogleConfig();
  if (!gConfig.clientId || !gConfig.clientSecret) {
    throw new GoogleAuthError('Google OAuth Client ID and Secret must be configured in Platform Settings', 'CONFIG_MISSING');
  }

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: gConfig.clientId,
      client_secret: gConfig.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000,
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new GoogleAuthError('No access token returned by Google', 'NO_ACCESS_TOKEN');
    }

    const userinfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 6000,
    });

    const userinfo = userinfoRes.data;
    return {
      googleId: userinfo.sub,
      email: userinfo.email.toLowerCase().trim(),
      name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim() || 'Google User',
      picture: userinfo.picture || null,
      emailVerified: userinfo.email_verified === true || userinfo.email_verified === 'true',
    };
  } catch (err) {
    logger.error(`[GoogleAuthService] Code exchange failed: ${err.message}`);
    throw new GoogleAuthError(
      err.response?.data?.error_description || err.message || 'Failed to exchange Google OAuth code',
      'CODE_EXCHANGE_FAILED'
    );
  }
}

/**
 * Authenticate existing user or automatically create new Tenant + User account
 */
async function authenticateOrRegisterGoogleUser({
  googleId,
  email,
  name,
  picture,
  phone = null,
  companyName = null,
  deviceInfo = 'Browser',
  ipAddress = '127.0.0.1',
  req = null,
}) {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Look for existing user by google_id or email
  let user = await User.scope('withPassword').findOne({
    where: {
      [Op.or]: [
        { google_id: googleId },
        { email: cleanEmail },
      ],
    },
  });

  const authService = require('./auth.service');
  let isNewAccount = false;
  let tenant = null;

  if (user) {
    // Existing user found -> Update Google link & avatar if missing
    tenant = await Tenant.findByPk(user.tenant_id);
    if (!tenant) {
      throw new GoogleAuthError('Associated merchant organization not found', 'TENANT_NOT_FOUND');
    }

    if (user.status === 'inactive') {
      throw new GoogleAuthError('Account is disabled. Please contact support.', 'ACCOUNT_DISABLED');
    }

    const updates = {};
    if (!user.google_id) updates.google_id = googleId;
    if (!user.avatar_url && picture) updates.avatar_url = picture;
    if (!user.email_verified_at) updates.email_verified_at = new Date();
    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }
  } else {
    // 2. Account Creation Flow -> Provision Workspace, Wallet, Role, and User
    isNewAccount = true;
    logger.info(`[GoogleAuthService] Auto-creating new account for Google user: ${cleanEmail}`);

    const resolvedCompanyName = (companyName || (name ? `${name}'s Store` : 'Merchant Store')).trim().slice(0, 140);
    const baseSubdomain = resolvedCompanyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30) || 'store';
    const uniqueSubdomain = `${baseSubdomain}${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await sequelize.transaction(async (t) => {
      // Create Tenant
      const newTenant = await Tenant.create({
        company_name: resolvedCompanyName,
        subdomain: uniqueSubdomain,
        status: 'active',
      }, { transaction: t });

      // Create Wallet
      await Wallet.create({
        tenant_id: newTenant.id,
        balance: 0.00,
        low_balance_threshold: 500.00,
        currency: 'INR',
      }, { transaction: t });

      // Initialize Subscription Plan
      await subscriptionPlanService.initializeTenantSubscription(newTenant.id, t);

      // Clone Owner Role
      const globalOwnerRole = await tenantRepository.findGlobalRoleByName('owner');
      if (!globalOwnerRole) {
        throw new Error('System owner role not found');
      }

      const tenantRole = await tenantRepository.createTenantRole({
        tenant_id: newTenant.id,
        name: 'owner',
        is_system_role: false,
      }, t);

      await tenantRepository.cloneRolePermissions(globalOwnerRole.id, tenantRole.id, t);

      // Default Courier Access - Safely ensure access without triggering unique constraint violation
      const defaultCouriers = await CourierProvider.findAll({
        where: { is_active: true },
        transaction: t,
      });
      for (const cp of defaultCouriers) {
        await TenantCourierAccess.findOrCreate({
          where: {
            tenant_id: newTenant.id,
            courier_provider_id: cp.id,
          },
          defaults: {
            is_enabled: true,
          },
          transaction: t,
        });
      }

      // Generate random secure password hash
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashUtils.hashPassword(randomSecret);

      // Create User
      const newUser = await User.create({
        tenant_id: newTenant.id,
        role_id: tenantRole.id,
        name: (name || 'Merchant').slice(0, 95),
        email: cleanEmail.slice(0, 145),
        password_hash: passwordHash,
        google_id: String(googleId).slice(0, 95),
        avatar_url: picture || null,
        phone: phone ? String(phone).slice(0, 20) : null,
        status: 'active',
        email_verified_at: new Date(),
      }, { transaction: t });

      return { tenant: newTenant, user: newUser };
    });

    user = result.user;
    tenant = result.tenant;

    // Send Welcome Email
    emailService.sendEmail({
      to: cleanEmail,
      subject: 'Welcome to Nanoshipy - Account Created with Google',
      htmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #7c3aed; margin: 0 0 16px 0; font-size: 22px; font-weight: 800;">Welcome to Nanoshipy!</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello ${name},</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Your Nanoshipy shipping workspace <strong>${resolvedCompanyName}</strong> has been created and activated with your Google account.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${config.frontendUrl}/dashboard" style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block;">
              Launch Seller Dashboard
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            © ${new Date().getFullYear()} Nanoshipy Logistics. All rights reserved. - <a href="https://growax360.com/" target="_blank" style="color: #7c3aed; text-decoration: underline;">Growax360</a>
          </p>
        </div>
      `,
    }).catch((mailErr) => {
      logger.warn(`[GoogleAuthService] Welcome email failed: ${mailErr.message}`);
    });
  }

  // 3. Issue JWT Access & Refresh Tokens
  const loginSession = await authService.completeLogin(user, tenant, deviceInfo, ipAddress, req);

  return {
    ...loginSession,
    is_new_account: isNewAccount,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url || picture,
      google_id: user.google_id,
      tenant_id: tenant.id,
      role: 'owner',
    },
    tenant: {
      id: tenant.id,
      company_name: tenant.company_name,
      subdomain: tenant.subdomain,
      status: tenant.status,
    },
    message: isNewAccount
      ? 'Google account created and workspace activated successfully!'
      : 'Logged in successfully with Google',
  };
}

module.exports = {
  getGoogleConfig,
  verifyGoogleIdToken,
  exchangeGoogleAuthCode,
  authenticateOrRegisterGoogleUser,
};
