const multer = require('multer');
const config = require('../config/env');

const storage = multer.memoryStorage();

const documentUpload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
    }
  },
});

const importUpload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream' // sometimes returned for CSVs
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || ['csv', 'xlsx', 'xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: .csv, .xlsx, .xls'), false);
    }
  },
});

module.exports = {
  documentUpload,
  importUpload,
  single: (field) => documentUpload.single(field),
};
