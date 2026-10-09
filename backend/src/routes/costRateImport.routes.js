'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const costRateImportController = require('../controllers/costRateImport.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const { costRateQuerySchema } = require('../validators/costRateImport.validator');

const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

router.use(isPlatformAdmin);

router.post('/cost-rates/import', canPlatform('admin.manage'), upload.single('file'), costRateImportController.importCostRates);
router.get('/cost-rates', canPlatform('admin.view'), validate(costRateQuerySchema, 'query'), costRateImportController.getCostRates);

module.exports = router;
