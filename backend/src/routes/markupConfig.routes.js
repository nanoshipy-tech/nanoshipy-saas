'use strict';

const express = require('express');
const router = express.Router();
const markupConfigController = require('../controllers/markupConfig.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const { createMarkupSchema, updateMarkupSchema, updateCodRtoSchema } = require('../validators/markupConfig.validator');

router.use(isPlatformAdmin);

router.get('/markup-config', canPlatform('admin.view'), markupConfigController.getMarkupConfig);
router.post('/markup-config', canPlatform('admin.manage'), validate(createMarkupSchema), markupConfigController.createMarkupRule);
router.put('/markup-config/:id', canPlatform('admin.manage'), validate(updateMarkupSchema), markupConfigController.updateMarkupRule);
router.delete('/markup-config/:id', canPlatform('admin.manage'), markupConfigController.deleteMarkupRule);

router.put('/cod-rto-config', canPlatform('admin.manage'), validate(updateCodRtoSchema), markupConfigController.updateCodRtoConfig);

module.exports = router;
