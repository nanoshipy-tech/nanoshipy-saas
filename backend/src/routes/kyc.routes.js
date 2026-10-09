'use strict';

const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

// Development-only simulation endpoint (disabled in production with path traversal protection)
if (process.env.NODE_ENV !== 'production') {
  router.get('/simulate-upload', kycController.simulateUpload);
}

// Seller/Tenant KYC endpoints
router.get('/status', authenticate, kycController.getKycStatus);
router.post('/business-details', authenticate, kycController.updateBusinessDetails);
router.post('/documents/upload', authenticate, kycController.getUploadUrl);
router.post('/bank-verify', authenticate, kycController.verifyBankDetails);
router.post('/submit', authenticate, kycController.submitKyc);

// Platform Admin KYC endpoints (RBAC strictly enforced)
router.get('/pending', isPlatformAdmin, canPlatform('admin.view'), kycController.getAdminQueue);
router.get('/platform/queue', isPlatformAdmin, canPlatform('admin.view'), kycController.getAdminQueue);
router.get('/platform/:sellerId', isPlatformAdmin, canPlatform('admin.view'), kycController.getAdminKycDetails);
router.post('/:sellerId/approve', isPlatformAdmin, canPlatform('platform_settings.manage'), kycController.approveKyc);
router.post('/platform/:sellerId/approve', isPlatformAdmin, canPlatform('platform_settings.manage'), kycController.approveKyc);
router.post('/:sellerId/reject', isPlatformAdmin, canPlatform('platform_settings.manage'), kycController.rejectKyc);
router.post('/platform/:sellerId/reject', isPlatformAdmin, canPlatform('platform_settings.manage'), kycController.rejectKyc);
router.post('/platform/:sellerId/request-resubmission', isPlatformAdmin, canPlatform('platform_settings.manage'), kycController.requestResubmission);
router.post('/platform/:sellerId/:action', isPlatformAdmin, canPlatform('platform_settings.manage'), (req, res, next) => {
  const { action } = req.params;
  if (action === 'approve') return kycController.approveKyc(req, res, next);
  if (action === 'reject') return kycController.rejectKyc(req, res, next);
  if (action === 'request-resubmission') return kycController.requestResubmission(req, res, next);
  return res.status(400).json({ success: false, error: { message: `Unsupported action: ${action}` } });
});

module.exports = router;
