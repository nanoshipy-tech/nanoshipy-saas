const express = require('express');
const c = require('../controllers/whatsappBspConfig.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

const router = express.Router();
router.use(isPlatformAdmin);

router.get('/config', c.getConfig);
router.put('/config', c.saveConfig);
router.post('/test', c.testConfig);
router.post('/disconnect', c.disconnectConfig);

module.exports = router;
