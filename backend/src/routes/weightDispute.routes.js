'use strict';

const express = require('express');
const router = express.Router();
const weightDisputeController = require('../controllers/weightDispute.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

const jwt = require('jsonwebtoken');

// Flexible list endpoint: if admin, list all disputes; if seller, list tenant's disputes
const flexibleDisputeListAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.decode(token);
    if (decoded && decoded.admin_id) {
      return isPlatformAdmin(req, res, () => weightDisputeController.listAllDisputes(req, res, next));
    }
    return authenticate(req, res, () => weightDisputeController.listMyDisputes(req, res, next));
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
};

// Seller routes
router.post('/', authenticate, weightDisputeController.fileDispute);
router.get('/', flexibleDisputeListAuth);
router.get('/:id', authenticate, weightDisputeController.getMyDispute);

// Admin routes
router.get('/platform/all', isPlatformAdmin, canPlatform('admin.view'), weightDisputeController.listAllDisputes);
router.put('/platform/:id/resolve', isPlatformAdmin, canPlatform('platform_settings.manage'), weightDisputeController.resolveDispute);
router.post('/platform/:id/resolve', isPlatformAdmin, weightDisputeController.resolveDispute);
router.post('/:id/resolve', isPlatformAdmin, weightDisputeController.resolveDispute);

module.exports = router;
