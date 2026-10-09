const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const getRefreshCookieOptions = (maxAgeMs = 30 * 24 * 60 * 60 * 1000) => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.nanoshipy.com' : undefined,
    path: '/',
    maxAge: maxAgeMs,
  };
};

const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.nanoshipy.com' : undefined,
    path: '/',
  };
};

const sendOtp = async (req, res, next) => {
  try {
    if (req.body && req.body.type === 'login') {
      const result = await authService.sendLoginOtp(req.body);
      return success(res, result);
    }
    const result = await authService.sendOtp(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const sendLoginOtp = async (req, res, next) => {
  try {
    const result = await authService.sendLoginOtp(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const result = await authService.register({ ...req.body, deviceInfo, ipAddress }, req);

    if (result.refresh_token) {
      res.cookie('refresh_token', result.refresh_token, getRefreshCookieOptions());
    }

    return success(res, result, 201);
  } catch (err) {
    logger.error('[AuthController Register Error]:', { error: err.message, stack: err.stack });
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    
    const result = await authService.login({ ...req.body, deviceInfo, ipAddress }, req);

    if (result.refresh_token) {
      res.cookie('refresh_token', result.refresh_token, getRefreshCookieOptions());
    }

    return success(res, result);
  } catch (err) {
    logger.error('[AuthController Login Error]:', { error: err.message, stack: err.stack });
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!token) {
      return res.status(200).json({ success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' } });
    }

    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket?.remoteAddress;

    const result = await authService.refreshToken({ token, deviceInfo, ipAddress });

    if (result.refresh_token) {
      res.cookie('refresh_token', result.refresh_token, getRefreshCookieOptions());
    }

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    const userId = req.user?.id || req.user?.user_id;
    
    await authService.logout(token, userId, req);
    
    res.clearCookie('refresh_token', getClearCookieOptions());
    res.clearCookie('refresh_token', { path: '/' });
    return success(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body, req);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body, req);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const { User, Tenant, Role } = require('../models');
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Tenant, as: 'tenant' },
        { model: Role, as: 'role' }
      ]
    });
    if (!user) {
      return success(res, req.user);
    }
    const { password_hash, two_factor_secret, viewable_password, ...safeUser } = user.toJSON();
    return success(res, { ...safeUser, permissions: req.user.permissions || [] });
  } catch (err) {
    next(err);
  }
};

const enable2FA = async (req, res, next) => {
  try {
    const result = await authService.enable2FA(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const confirm2FA = async (req, res, next) => {
  try {
    const result = await authService.confirm2FA(req.user.id, req.body.otp, req);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const verify2FA = async (req, res, next) => {
  try {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    
    const result = await authService.verify2FA({ ...req.body, deviceInfo, ipAddress }, req);

    if (result.refresh_token) {
      res.cookie('refresh_token', result.refresh_token, getRefreshCookieOptions());
    }

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const result = await authService.resendVerification(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const myPermissions = async (req, res, next) => {
  try {
    const rbacService = require('../services/rbac.service');
    const permissions = await rbacService.getUserPermissions(req.user.id);
    return success(res, { permissions });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendOtp,
  sendLoginOtp,
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  me,
  myPermissions,
  enable2FA,
  confirm2FA,
  verify2FA,
};
