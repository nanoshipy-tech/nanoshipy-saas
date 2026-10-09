'use strict';

const googleAuthService = require('../services/googleAuth.service');
const { success, error } = require('../utils/apiResponse');
const config = require('../config/env');
const logger = require('../utils/logger');

class GoogleAuthController {
  /**
   * GET /api/v1/auth/google/config
   * Public endpoint so frontend knows if Google login is enabled and gets the client ID.
   */
  async getConfig(req, res, next) {
    try {
      const gConfig = await googleAuthService.getGoogleConfig();
      return success(res, {
        enabled: gConfig.enabled,
        client_id: gConfig.clientId,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/google
   * Authenticates or creates account with Google ID token or authorization code.
   */
  async authenticate(req, res, next) {
    try {
      const { credential, code, redirect_uri, company_name, phone } = req.body;

      if (!credential && !code) {
        return error(res, 'Google credential (ID token) or authorization code is required', 400, 'MISSING_CREDENTIAL');
      }

      let profile;
      if (credential) {
        profile = await googleAuthService.verifyGoogleIdToken(credential);
      } else {
        const rUri = redirect_uri || `${config.appUrl}/api/v1/auth/google/callback`;
        profile = await googleAuthService.exchangeGoogleAuthCode(code, rUri);
      }

      const deviceInfo = req.headers['user-agent'] || 'Browser';
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const result = await googleAuthService.authenticateOrRegisterGoogleUser({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        phone,
        companyName: company_name,
        deviceInfo,
        ipAddress,
        req,
      });

      return success(res, result, result.message);
    } catch (err) {
      logger.error(`[GoogleAuthController] Auth error: ${err.message}`);
      return error(res, err.message, 400, err.code || 'GOOGLE_AUTH_FAILED');
    }
  }

  /**
   * GET /api/v1/auth/google/url
   * Returns Google OAuth URL for direct redirects.
   */
  async getAuthUrl(req, res, next) {
    try {
      const gConfig = await googleAuthService.getGoogleConfig();
      if (!gConfig.clientId) {
        return error(res, 'Google OAuth Client ID is not configured', 400, 'CONFIG_MISSING');
      }

      const redirectUri = req.query.redirect_uri || `${config.appUrl}/api/v1/auth/google/callback`;
      const state = req.query.state || 'seller_login';

      const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
      const options = {
        redirect_uri: redirectUri,
        client_id: gConfig.clientId,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
        state,
      };

      const qs = new URLSearchParams(options).toString();
      return success(res, { url: `${rootUrl}?${qs}` });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/google/callback
   * OAuth2 callback endpoint for code exchange redirect.
   */
  async handleCallback(req, res, next) {
    try {
      const { code, error: googleError } = req.query;

      if (googleError || !code) {
        logger.warn(`[GoogleAuthController] Google OAuth returned error or no code: ${googleError}`);
        return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(googleError || 'Google authentication cancelled')}`);
      }

      const redirectUri = `${config.appUrl}/api/v1/auth/google/callback`;
      const profile = await googleAuthService.exchangeGoogleAuthCode(code, redirectUri);

      const deviceInfo = req.headers['user-agent'] || 'Browser';
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const result = await googleAuthService.authenticateOrRegisterGoogleUser({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        deviceInfo,
        ipAddress,
        req,
      });

      // Redirect to frontend auth callback with token
      const redirectTarget = `${config.frontendUrl}/auth/callback?token=${result.access_token}&refresh=${result.refresh_token}&new=${result.is_new_account ? '1' : '0'}`;
      return res.redirect(redirectTarget);
    } catch (err) {
      logger.error(`[GoogleAuthController] Callback exchange error: ${err.message}`);
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
    }
  }
}

module.exports = new GoogleAuthController();
