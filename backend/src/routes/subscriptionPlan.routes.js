'use strict';

const express = require('express');
const router = express.Router();
const subscriptionPlanController = require('../controllers/subscriptionPlan.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const validate = require('../middlewares/validate.middleware');
const { planSchema } = require('../validators/subscriptionPlan.validator');

// Platform Superadmin Oversight endpoints
router.get('/platform/plans', isPlatformAdmin, subscriptionPlanController.listPlans);
router.post('/platform/plans', isPlatformAdmin, validate(planSchema), subscriptionPlanController.createPlan);
router.put('/platform/plans/:id', isPlatformAdmin, validate(planSchema), subscriptionPlanController.updatePlan);
router.put('/platform/plans/:id/archive', isPlatformAdmin, subscriptionPlanController.archivePlan);
router.post('/platform/tenants/:tenantId/subscription/assign', isPlatformAdmin, subscriptionPlanController.assignPlan);

module.exports = router;
