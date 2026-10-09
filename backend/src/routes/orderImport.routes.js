const express = require('express');
const router = express.Router();
const orderImportController = require('../controllers/orderImport.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const { importUpload } = require('../middlewares/upload.middleware');
const { requireApprovedKyc } = require('../middlewares/requireApprovedKyc.middleware');

router.use(authenticate);

const { error } = require('../utils/apiResponse');

// Guard: Enforce booking office restriction on bulk imports
const enforceBookingOfficeBulkRestriction = async (req, res, next) => {
  const isBookingOffice = Boolean(req.tenant?.is_booking_office);
  if (isBookingOffice) {
    return error(res, {
      code: 'BOOKING_OFFICE_RESTRICTED',
      message: 'Bulk order import is disabled for Booking Office accounts. Please use Walk-in Counter Booking.',
    }, 403);
  }
  next();
};

// Order Bulk Upload Routes
router.get('/template', can('order.bulk_upload'), orderImportController.downloadTemplate);
router.post('/bulk-import', can('order.bulk_upload'), requireApprovedKyc, enforceBookingOfficeBulkRestriction, importUpload.single('file'), orderImportController.bulkImport);
router.get('/imports', can('order.bulk_upload'), orderImportController.listImports);
router.get('/imports/:id', can('order.bulk_upload'), orderImportController.getImportById);
router.get('/bulk-imports', can('order.bulk_upload'), orderImportController.listImports);
router.get('/bulk-imports/:id', can('order.bulk_upload'), orderImportController.getImportById);

module.exports = router;
