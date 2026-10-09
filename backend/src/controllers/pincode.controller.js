'use strict';

const pincodeService = require('../services/pincode.service');
const { PlatformSetting, PincodeMaster } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * GET /api/v1/location/pincode/:pincode
 * Lookup pincode details (state, district, city, serviceability).
 */
const getPincodeDetails = async (req, res, next) => {
  try {
    const { pincode } = req.params;
    const tenantId = req.user?.tenant_id || req.tenant?.id || null;

    const result = await pincodeService.lookupPincode(pincode, tenantId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'PINCODE_NOT_FOUND',
          message: result.message || 'Pincode not found.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      cached: !!result.cached,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to parse Google Places Details address components
 */
const parseGoogleAddressComponents = (result) => {
  const components = result.address_components || [];
  let streetNumber = '';
  let route = '';
  let sublocality = '';
  let locality = '';
  let district = '';
  let state = '';
  let pincode = '';
  let country = 'India';

  for (const c of components) {
    const types = c.types || [];
    if (types.includes('postal_code')) {
      pincode = c.long_name;
    } else if (types.includes('locality')) {
      locality = c.long_name;
    } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
      sublocality = c.long_name;
    } else if (types.includes('administrative_area_level_2')) {
      district = c.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      state = c.long_name;
    } else if (types.includes('route')) {
      route = c.long_name;
    } else if (types.includes('street_number') || types.includes('premise') || types.includes('subpremise')) {
      streetNumber = c.long_name;
    } else if (types.includes('country')) {
      country = c.long_name;
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(' ') || sublocality || result.name || '';
  const city = locality || district || sublocality || '';

  return {
    formatted_address: result.formatted_address || '',
    street_address: streetAddress,
    area_landmark: sublocality,
    city,
    district,
    state,
    pincode,
    country,
  };
};

/**
 * GET /api/v1/location/places-autocomplete
 * Proxy Google Places Autocomplete requests safely with local fallback.
 */
const getPlacesAutocomplete = async (req, res, next) => {
  try {
    const input = (req.query.input || '').trim();
    if (!input || input.length < 2) {
      return res.json({ success: true, enabled: false, predictions: [] });
    }

    const settings = await PlatformSetting.findAll({
      where: {
        setting_key: ['google_places_enabled', 'google_maps_api_key'],
      },
    });

    const map = {};
    settings.forEach(s => { map[s.setting_key] = s.setting_value; });

    const enabled = map['google_places_enabled'] === 'true';
    const apiKey = map['google_maps_api_key'];

    // 1. If Google Maps enabled and valid API key configured, query Google Places API
    if (enabled && apiKey && !apiKey.includes('FakeKey')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${encodeURIComponent(apiKey)}`;
        const googleRes = await axios.get(url, { timeout: 4000 });
        const data = googleRes.data || {};

        if (data.status === 'OK' && Array.isArray(data.predictions) && data.predictions.length > 0) {
          return res.json({
            success: true,
            enabled: true,
            source: 'google',
            predictions: data.predictions.map(p => ({
              description: p.description,
              place_id: p.place_id,
              main_text: p.structured_formatting?.main_text || p.description,
              secondary_text: p.structured_formatting?.secondary_text || '',
            })),
          });
        }
      } catch (googleErr) {
        logger.warn('[PlacesAutocomplete Google API Error]:', googleErr.message);
      }
    }

    // 2. Local Indian Pincode & City Fallback Suggestions
    try {
      const isPostgres = process.env.SEQUELIZE_DIALECT !== 'sqlite';
      const likeOp = isPostgres ? Op.iLike : Op.like;

      const localMatches = await PincodeMaster.findAll({
        where: {
          [Op.or]: [
            { city: { [likeOp]: `%${input}%` } },
            { district: { [likeOp]: `%${input}%` } },
            { pincode: { [Op.like]: `${input}%` } },
          ],
          is_serviceable: true,
        },
        limit: 8,
      });

      if (localMatches && localMatches.length > 0) {
        return res.json({
          success: true,
          enabled: true,
          source: 'local',
          predictions: localMatches.map(m => {
            const locName = m.city || m.district || 'Location';
            const stateName = m.state || '';
            const pin = m.pincode;
            return {
              description: `${locName}, ${m.district && m.district !== locName ? m.district + ', ' : ''}${stateName} ${pin}`,
              place_id: `pin:${pin}`,
              main_text: locName,
              secondary_text: `${stateName} - ${pin}`,
            };
          }),
        });
      }
    } catch (dbErr) {
      logger.warn('[PlacesAutocomplete Local DB Lookup Error]:', dbErr.message);
    }

    return res.json({ success: true, enabled: enabled, predictions: [] });
  } catch (err) {
    logger.warn('[PlacesAutocomplete Proxy Error]:', err.message);
    return res.json({ success: true, enabled: false, predictions: [], error: err.message });
  }
};

/**
 * GET /api/v1/location/place-details
 * Retrieve postal code, city, district, state, and street details for a selected place.
 */
const getPlaceDetails = async (req, res, next) => {
  try {
    const placeId = (req.query.place_id || '').trim();
    if (!placeId) {
      return res.status(400).json({ success: false, message: 'place_id query param is required' });
    }

    // 1. Handle local fallback place IDs (pin:110001)
    if (placeId.startsWith('pin:')) {
      const pin = placeId.replace('pin:', '').trim();
      const record = await PincodeMaster.findOne({ where: { pincode: pin } });
      if (record) {
        return res.json({
          success: true,
          data: {
            formatted_address: `${record.city || record.district}, ${record.state} ${record.pincode}, India`,
            street_address: record.city || record.district || '',
            area_landmark: record.district || '',
            city: record.city || record.district || '',
            district: record.district || '',
            state: record.state || '',
            pincode: record.pincode,
            country: 'India',
          },
        });
      }
    }

    // 2. Handle Google Places place_id
    const settings = await PlatformSetting.findAll({
      where: {
        setting_key: ['google_places_enabled', 'google_maps_api_key'],
      },
    });

    const map = {};
    settings.forEach(s => { map[s.setting_key] = s.setting_value; });

    const apiKey = map['google_maps_api_key'];
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,formatted_address,name&key=${encodeURIComponent(apiKey)}`;
    const googleRes = await axios.get(url, { timeout: 5000 });
    const data = googleRes.data || {};

    if (data.status !== 'OK' || !data.result) {
      return res.status(400).json({
        success: false,
        message: data.error_message || 'Could not fetch place details from Google Maps',
      });
    }

    const parsed = parseGoogleAddressComponents(data.result);
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    logger.warn('[PlaceDetails Error]:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPincodeDetails,
  getPlacesAutocomplete,
  getPlaceDetails,
};
