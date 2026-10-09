'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const pincodeController = require('../controllers/pincode.controller');

const router = express.Router();

/**
 * @route   GET /api/v1/location/pincode/:pincode
 * @desc    Lookup state, district, city for a 6-digit Indian pincode
 * @access  Private (Authenticated Users / Merchants)
 */
router.get('/pincode/:pincode', authenticate, pincodeController.getPincodeDetails);

/**
 * @route   GET /api/v1/location/places-autocomplete
 * @desc    Google Places Autocomplete proxy
 * @access  Private (Authenticated Users / Merchants)
 */
router.get('/places-autocomplete', authenticate, pincodeController.getPlacesAutocomplete);

/**
 * @route   GET /api/v1/location/place-details
 * @desc    Get Google Places or local place details (pincode, city, state, address)
 * @access  Private (Authenticated Users / Merchants)
 */
router.get('/place-details', authenticate, pincodeController.getPlaceDetails);

module.exports = router;
