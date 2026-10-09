const express = require('express');
const platformTenantController = require('../controllers/platformTenant.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');

const router = express.Router();

router.use(isPlatformAdmin);

router.get('/', platformTenantController.listSellers);
router.get('/:id', platformTenantController.getTenantDetails);
router.put('/:id', platformTenantController.updateTenantProfile);
router.patch('/:id', platformTenantController.updateTenantProfile);
router.put('/:id/status', platformTenantController.updateTenantStatus);
router.put('/:id/kyc', platformTenantController.updateTenantKyc);
router.post('/:id/wallet/adjust', canPlatform('finance.manage'), platformTenantController.adjustWallet);

// Password Management
router.post('/:id/password', canPlatform('super_admin'), platformTenantController.updateSellerPassword);

// Warehouse / Pickup Address Management
router.get('/:id/addresses', platformTenantController.getSellerWarehouses);
router.post('/:id/addresses', platformTenantController.createSellerWarehouse);
router.put('/:id/addresses/:addressId', platformTenantController.updateSellerWarehouse);
router.delete('/:id/addresses/:addressId', platformTenantController.deleteSellerWarehouse);

// Payment Terms & Postpaid Endpoints
router.get('/:id/payment-terms', platformTenantController.getPaymentTerms);
router.put('/:id/payment-terms', platformTenantController.updatePaymentTerms);
router.get('/:id/postpaid/summary', platformTenantController.getPostpaidSummary);
router.get('/:id/postpaid/invoices', platformTenantController.listPostpaidInvoices);
router.get('/:id/postpaid/ledger', platformTenantController.listPostpaidLedger);
router.post('/:id/postpaid/payments', platformTenantController.recordPostpaidPayment);

// Account Deletion & Local Drive Backup
router.get('/:id/pre-delete-check', platformTenantController.getPreDeleteCheck);
router.get('/:id/backup', platformTenantController.downloadSellerBackup);
router.delete('/:id', canPlatform('super_admin'), platformTenantController.deleteSellerAccount);

module.exports = router;

