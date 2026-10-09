'use strict';

const express = require('express');
const router = express.Router();
const shippingAllocationRuleController = require('../controllers/shippingAllocationRule.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

// Available couriers catalog (Shipway carriers + ST Courier)
router.get('/carriers', (req, res, next) => shippingAllocationRuleController.getAvailableCouriers(req, res, next));
router.get('/couriers', (req, res, next) => shippingAllocationRuleController.getAvailableCouriers(req, res, next));
router.get('/available-couriers', (req, res, next) => shippingAllocationRuleController.getAvailableCouriers(req, res, next));

// Reorder priorities
router.post('/reorder', (req, res, next) => shippingAllocationRuleController.reorderRules(req, res, next));

// Rules CRUD
router.get('/', (req, res, next) => shippingAllocationRuleController.listRules(req, res, next));
router.post('/', (req, res, next) => shippingAllocationRuleController.createRule(req, res, next));
router.get('/:id', (req, res, next) => shippingAllocationRuleController.getRuleById(req, res, next));
router.put('/:id', (req, res, next) => shippingAllocationRuleController.updateRule(req, res, next));
router.delete('/:id', (req, res, next) => shippingAllocationRuleController.deleteRule(req, res, next));
router.patch('/:id/toggle', (req, res, next) => shippingAllocationRuleController.toggleRuleStatus(req, res, next));

module.exports = router;
