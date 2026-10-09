'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const blogController = require('../controllers/blog.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

const uploadBlogsDir = path.join(__dirname, '../../uploads/blogs');
if (!fs.existsSync(uploadBlogsDir)) {
  fs.mkdirSync(uploadBlogsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadBlogsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `blog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
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

// ================= PUBLIC BLOG ROUTES =================
router.get('/', blogController.getPublicBlogs);
router.get('/:slug', blogController.getPublicBlogBySlug);

// ================= ADMIN BLOG STUDIO ROUTES =================
router.get('/admin/list', isPlatformAdmin, blogController.getAdminBlogs);
router.get('/admin/detail/:id', isPlatformAdmin, blogController.getAdminBlogById);
router.post('/', isPlatformAdmin, handleUpload, blogController.createBlog);
router.put('/:id', isPlatformAdmin, handleUpload, blogController.updateBlog);
router.delete('/:id', isPlatformAdmin, blogController.deleteBlog);

// Standalone image upload for blog rich text editor insertion
router.post('/upload-image', isPlatformAdmin, handleUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
  }
  return res.json({
    success: true,
    data: {
      url: `/uploads/blogs/${req.file.filename}`,
      filename: req.file.filename,
    },
  });
});

module.exports = router;
