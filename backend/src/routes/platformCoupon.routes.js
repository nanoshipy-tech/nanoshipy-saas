'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/platformCoupon.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.use(isPlatformAdmin);

router.get('/', c.listCoupons);
router.post('/', c.createCoupon);
router.get('/:id', c.getCoupon);
router.put('/:id', c.updateCoupon);
router.patch('/:id/toggle', c.toggleCouponStatus);
router.delete('/:id', c.deleteCoupon);

module.exports = router;
