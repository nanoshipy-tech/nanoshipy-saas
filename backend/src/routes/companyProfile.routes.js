const express = require('express');
const router = express.Router();
const companyProfileController = require('../controllers/companyProfile.controller');
const { updateProfileSchema, uploadDocumentSchema } = require('../validators/companyProfile.validator');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

router.use(authenticate);

// Company Profile Routes
router.get('/', can('company.view'), companyProfileController.getProfile);
router.put('/', can('company.update'), validate(updateProfileSchema, 'body'), companyProfileController.updateProfile);
router.post('/logo', can('company.update'), uploadMiddleware.single('logo'), companyProfileController.uploadLogo);

// Company Documents Routes
router.get('/documents', can('company.view'), companyProfileController.getDocuments);
router.post('/documents', can('company.update'), uploadMiddleware.single('document'), validate(uploadDocumentSchema, 'body'), companyProfileController.uploadDocument);
router.delete('/documents/:id', can('company.update'), companyProfileController.deleteDocument);

// Merchant Impersonation Access Logs
router.get('/admin-access-logs', can('company.view'), companyProfileController.getAdminAccessLogs);

module.exports = router;
