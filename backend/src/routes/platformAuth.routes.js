const express = require('express');
const platformAuthController = require('../controllers/platformAuth.controller');
const { isPlatformAdmin, isPlatformAdminTemp } = require('../middlewares/platformAuth.middleware');
const { validateLogin, validateVerify2FA } = require('../validators/platformAuth.validator');

const router = express.Router();

router.post('/login', validateLogin, platformAuthController.login);
router.post('/send-otp', platformAuthController.sendOtp);
router.post('/login-otp', platformAuthController.loginWithOtp);
router.post('/2fa/verify', isPlatformAdminTemp, validateVerify2FA, platformAuthController.verify2FA); // Requires temp token
router.post('/logout', platformAuthController.logout);
router.post('/refresh', platformAuthController.refresh);
router.post('/forgot-password', platformAuthController.forgotPassword);
router.post('/reset-password', platformAuthController.resetPassword);

router.get('/me', isPlatformAdmin, platformAuthController.getMe);
router.get('/admins', isPlatformAdmin, platformAuthController.listAdmins);
router.post('/admins', isPlatformAdmin, platformAuthController.createAdmin);
router.put('/admins/:id/role', isPlatformAdmin, platformAuthController.updateAdminRole);
router.put('/admins/:id/status', isPlatformAdmin, platformAuthController.updateAdminStatus);
router.post('/admins/:id/reset-password', isPlatformAdmin, platformAuthController.resetAdminPassword);
router.delete('/admins/:id', isPlatformAdmin, platformAuthController.deleteAdmin);

module.exports = router;

