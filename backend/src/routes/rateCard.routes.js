'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateCardController = require('../controllers/rateCard.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateRateCardSchema } = require('../validators/rateCard.validator');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Flexible Auth Middleware (allows both Seller Users and Platform Admins)
const flexibleRateCardAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  // Attempt Seller User authentication first
  try {
    return await authenticate(req, res, next);
  } catch (err) {
    // If seller auth fails, attempt Platform Admin authentication
    try {
      return await isPlatformAdmin(req, res, next);
    } catch (adminErr) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  }
};

// Rate Card Sample Template Download
router.get('/template', rateCardController.getTemplate);

// Rate Cards CSV Export (RFC 4180 Quoted)
router.get('/export', flexibleRateCardAuth, rateCardController.exportRateCards);

// Rate Cards List (Accessible to both Sellers & Platform Admins)
router.get('/', flexibleRateCardAuth, rateCardController.listRateCards);

// Platform Admin Only Routes
router.get('/history', isPlatformAdmin, rateCardController.getHistory);
router.post('/preview', isPlatformAdmin, upload.single('file'), rateCardController.previewRateCards);
router.get('/margin-report', isPlatformAdmin, canPlatform('report.view'), rateCardController.getMarginReport);
router.post('/import', isPlatformAdmin, canPlatform('rate_card.manage'), upload.single('file'), rateCardController.importRateCards);
router.put('/:id', isPlatformAdmin, canPlatform('rate_card.manage'), validate(updateRateCardSchema), rateCardController.updateRateCard);

module.exports = router;
