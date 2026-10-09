'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bannerController = require('../controllers/banner.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

const uploadBannersDir = path.join(__dirname, '../../uploads/banners');
if (!fs.existsSync(uploadBannersDir)) {
  fs.mkdirSync(uploadBannersDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadBannersDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/svg+xml', 'image/avif', 'image/pjpeg', 'image/x-png'
    ];
    const isExtAllowed = /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.originalname);
    if (allowedMimes.includes(file.mimetype) || isExtAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, GIF, SVG, and AVIF images are allowed'), false);
    }
  },
});

const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: { message: err.message || 'Image upload failed' } });
    }
    next();
  });
};

const router = express.Router();

// ================= PUBLIC / SELLER BANNER ROUTES =================
router.get('/active', bannerController.getActiveBanner);

// ================= BANNER STUDIO ROUTES (Platform Admin Only) =================
router.get('/', isPlatformAdmin, bannerController.getAllBanners);
router.post('/', isPlatformAdmin, handleUpload, bannerController.createBanner);
router.put('/:id', isPlatformAdmin, handleUpload, bannerController.updateBanner);
router.delete('/:id', isPlatformAdmin, bannerController.deleteBanner);

// Standalone banner image upload (Platform Admin Only)
router.post('/upload', isPlatformAdmin, handleUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
  }
  return res.json({
    success: true,
    data: {
      url: `/uploads/banners/${req.file.filename}`,
      filename: req.file.filename,
    },
  });
});

module.exports = router;
