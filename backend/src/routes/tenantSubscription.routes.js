'use strict';

const express = require('express');
const router = express.Router();
const tenantSubscriptionController = require('../controllers/tenantSubscription.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { changePlanSchema } = require('../validators/subscriptionPlan.validator');

router.get('/subscription', authenticate, can('subscription.view'), tenantSubscriptionController.getSubscription);
router.get('/subscription/plans', authenticate, can('subscription.view'), tenantSubscriptionController.listTenantPlans);
router.post('/subscription/change', authenticate, can('subscription.manage'), validate(changePlanSchema), tenantSubscriptionController.changePlan);
router.put('/subscription/auto-renew', authenticate, can('subscription.manage'), tenantSubscriptionController.toggleAutoRenew);

module.exports = router;
