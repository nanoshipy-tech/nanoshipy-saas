const express = require('express');
const c = require('../controllers/storefrontConnection.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireApprovedKyc } = require('../middlewares/requireApprovedKyc.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', c.listConnections);
router.post('/', requireApprovedKyc, c.connectStorefront);
router.post('/shopify/connect', requireApprovedKyc, c.connectShopify);
router.post('/woocommerce/connect', requireApprovedKyc, c.connectWooCommerce);
router.get('/:id', c.getConnection);
router.put('/:id', requireApprovedKyc, c.updateConnection);
router.delete('/:id', c.disconnectStorefront);
router.post('/:id/sync', requireApprovedKyc, c.triggerSync);
router.get('/:id/logs', c.getSyncLogs);
router.get('/:id/orders', c.getConnectionOrders);

module.exports = router;
