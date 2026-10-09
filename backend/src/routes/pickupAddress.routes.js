const express = require('express');
const router = express.Router();
const pickupAddressController = require('../controllers/pickupAddress.controller');
const { createAddressSchema, updateAddressSchema, queryAddressesSchema } = require('../validators/pickupAddress.validator');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

router.use(authenticate);

router.get('/', can('address.view'), validate(queryAddressesSchema, 'query'), pickupAddressController.getAddresses);
router.post('/', can('address.create'), validate(createAddressSchema, 'body'), pickupAddressController.createAddress);

router.get('/:id', can('address.view'), pickupAddressController.getAddressById);
router.put('/:id', can('address.update'), validate(updateAddressSchema, 'body'), pickupAddressController.updateAddress);
router.delete('/:id', can('address.delete'), pickupAddressController.deleteAddress);

router.put('/:id/set-default', can('address.update'), pickupAddressController.setDefault);

module.exports = router;
