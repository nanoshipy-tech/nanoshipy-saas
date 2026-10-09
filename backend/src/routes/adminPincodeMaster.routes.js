'use strict';

const express = require('express');
const multer = require('multer');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const adminPincodeMasterController = require('../controllers/adminPincodeMaster.controller');

const path = require('path');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (ext === '.csv' || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only CSV files (.csv) are allowed.'));
    }
  },
});
const router = express.Router();

router.use(isPlatformAdmin);

/**
 * @route   GET /api/v1/platform/pincodes/template
 * @desc    Download sample CSV template for pincode master bulk upload
 */
router.get('/template', adminPincodeMasterController.downloadTemplate);
router.get('/pincode-master/template', adminPincodeMasterController.downloadTemplate);

/**
 * @route   POST /api/v1/platform/pincodes/validate-csv
 * @desc    Validate CSV upload and preview row validation breakdown
 */
router.post('/validate-csv', upload.single('file'), adminPincodeMasterController.previewPincodes);
router.post('/preview', upload.single('file'), adminPincodeMasterController.previewPincodes);
router.post('/pincode-master/preview', upload.single('file'), adminPincodeMasterController.previewPincodes);

/**
 * @route   POST /api/v1/platform/pincodes/upload
 * @desc    Bulk upload/update pincode master records (Replace or Append mode)
 */
router.post('/upload', upload.single('file'), adminPincodeMasterController.uploadPincodes);
router.post('/pincode-master/upload', upload.single('file'), adminPincodeMasterController.uploadPincodes);

/**
 * @route   POST /api/v1/platform/pincodes
 * @desc    Create or update an individual location / serviceable pincode
 */
router.post('/', adminPincodeMasterController.createPincode);
router.post('/create', adminPincodeMasterController.createPincode);
router.post('/pincode-master', adminPincodeMasterController.createPincode);

/**
 * @route   DELETE /api/v1/platform/pincodes/:pincode
 * @desc    Delete an individual location / pincode record
 */
router.delete('/:pincode', adminPincodeMasterController.deletePincode);

/**
 * @route   GET /api/v1/platform/pincodes
 * @desc    Search and paginate active pincode master entries
 */
router.get('/', adminPincodeMasterController.listPincodes);
router.get('/pincodes', adminPincodeMasterController.listPincodes);
router.get('/pincode-master', adminPincodeMasterController.listPincodes);

module.exports = router;
