const express = require('express');
const c = require('../controllers/sellerWebhook.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', c.listWebhooks);
router.post('/', c.createWebhook);
router.put('/:id', c.updateWebhook);
router.delete('/:id', c.deleteWebhook);
router.post('/:id/test', c.sendTestEvent);
router.get('/:id/logs', c.getDeliveryLogs);

module.exports = router;
