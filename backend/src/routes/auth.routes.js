const express = require('express');
const authController = require('../controllers/auth.controller');
const authValidator = require('../validators/auth.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { loginLimiter, forgotPasswordLimiter } = require('../middlewares/rateLimiter.middleware');

const googleAuthController = require('../controllers/googleAuth.controller');

const router = express.Router();

// Google OAuth & Account Creation
router.get('/google/config', (req, res, next) => googleAuthController.getConfig(req, res, next));
router.post('/google', loginLimiter, (req, res, next) => googleAuthController.authenticate(req, res, next));
router.get('/google/url', (req, res, next) => googleAuthController.getAuthUrl(req, res, next));
router.get('/google/callback', (req, res, next) => googleAuthController.handleCallback(req, res, next));

// Public
router.post('/send-otp', authController.sendOtp);

router.post(
  '/register',
  authValidator.validate(authValidator.schemas.register),
  authController.register
);

router.post(
  '/verify-email',
  authValidator.validate(authValidator.schemas.verifyEmail),
  authController.verifyEmail
);

router.post(
  '/resend-verification',
  authController.resendVerification
);

router.post(
  '/login',
  loginLimiter,
  authValidator.validate(authValidator.schemas.login),
  authController.login
);

router.post(
  '/login/send-otp',
  loginLimiter,
  authValidator.validate(authValidator.schemas.sendLoginOtp),
  authController.sendLoginOtp
);

router.post(
  '/login/otp',
  loginLimiter,
  authValidator.validate(authValidator.schemas.login),
  authController.login
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  authValidator.validate(authValidator.schemas.forgotPassword),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authValidator.validate(authValidator.schemas.resetPassword),
  authController.resetPassword
);

// Refresh Token
router.post('/refresh', authController.refreshToken);
router.post('/refresh-token', authController.refreshToken);

// 2FA - Public (requires temp_token / pre_auth_token)
router.post(
  '/2fa/verify',
  loginLimiter,
  authValidator.validate(authValidator.schemas.verify2FA),
  authController.verify2FA
);
router.post(
  '/verify-2fa',
  loginLimiter,
  authValidator.validate(authValidator.schemas.verify2FA),
  authController.verify2FA
);

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const { verifyAccessToken } = require('../services/token.service');
    const payload = verifyAccessToken(token);
    req.user = { id: payload.user_id, ...payload };
  } catch (e) {
    // expired or invalid access token — proceed so logout can still revoke refresh token
  }
  next();
};

router.post('/logout', optionalAuth, authController.logout);

// Protected
router.use(authenticate);

router.get('/me', authController.me);
router.get('/my-permissions', authController.myPermissions);

router.post('/2fa/enable', authController.enable2FA);
router.post(
  '/2fa/confirm',
  authValidator.validate(authValidator.schemas.confirm2FA),
  authController.confirm2FA
);

module.exports = router;
