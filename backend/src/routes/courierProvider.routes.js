'use strict';

const express = require('express');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const courierProviderController = require('../controllers/courierProvider.controller');
const {
  createProviderSchema,
  updateProviderSchema,
  grantAccessSchema,
} = require('../validators/courierProvider.validator');

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadCouriersDir = path.join(__dirname, '../../uploads/couriers');
if (!fs.existsSync(uploadCouriersDir)) {
  fs.mkdirSync(uploadCouriersDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadCouriersDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const providerKey = (req.params.providerKey || 'courier').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const uniqueName = `courier_${providerKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/svg+xml', 'image/avif', 'image/pjpeg', 'image/x-png'
    ];
    const isExtAllowed = /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.originalname);
    if (allowedMimes.includes(file.mimetype) || isExtAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, SVG, and GIF images are allowed'), false);
    }
  },
});

const handleLogoUpload = (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: { message: err.message || 'Logo upload failed' } });
    }
    next();
  });
};

const router = express.Router();

// Apply platform authentication
router.use(isPlatformAdmin);

router.get('/', canPlatform('courier.view'), courierProviderController.list);
router.get('/routing-rules', canPlatform('courier.view'), courierProviderController.getRoutingRules);
router.post('/', canPlatform('courier.manage'), validate(createProviderSchema), courierProviderController.onboard);

// Courier logo upload endpoints
router.post('/upload-logo', canPlatform('courier.manage'), handleLogoUpload, courierProviderController.uploadLogo);
router.post('/:providerKey/logo', canPlatform('courier.manage'), handleLogoUpload, courierProviderController.uploadLogoByKey);

// ── By provider_key (code) routes — used by admin UI ──────────────────────────
// These must come BEFORE /:id routes to avoid UUID conflicts
router.put('/:providerKey/test', canPlatform('courier.manage'), courierProviderController.testByKey);   // alias: allow GET from test button
router.post('/:providerKey/test', canPlatform('courier.manage'), courierProviderController.testByKey);  // POST /platform/couriers/shipway/test
router.patch('/:providerKey/status', canPlatform('courier.manage'), courierProviderController.toggleByKey); // PATCH /platform/couriers/shipway/status
router.put('/:providerKey', canPlatform('courier.manage'), courierProviderController.updateByKey);      // PUT /platform/couriers/shipway

// ── By UUID routes — used by internal services ────────────────────────────────
router.get('/:id', canPlatform('courier.view'), courierProviderController.getById);
router.put('/:id', canPlatform('courier.manage'), validate(updateProviderSchema), courierProviderController.update);
router.put('/:id/toggle', canPlatform('courier.manage'), courierProviderController.toggle);

router.post('/:id/health-check', canPlatform('courier.manage'), courierProviderController.healthCheck);
router.get('/:id/health-logs', canPlatform('courier.view'), courierProviderController.healthLogs);

router.get('/:id/circuit-breaker', canPlatform('courier.view'), courierProviderController.getCircuitBreakerStatus);
router.post('/:id/circuit-breaker/reset', canPlatform('courier.manage'), courierProviderController.resetCircuitBreaker);

router.post('/:id/tenant-access', canPlatform('courier.manage'), validate(grantAccessSchema), courierProviderController.grantAccess);
router.delete('/:id/tenant-access/:tenantId', canPlatform('courier.manage'), courierProviderController.revokeAccess);

module.exports = router;
