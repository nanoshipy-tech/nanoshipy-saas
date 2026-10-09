'use strict';

const { StCourierServiceablePincode, PincodeMaster } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { getPincodeLocation } = require('../services/zoneResolver');

/**
 * List ST Courier serviceable pincodes with pagination & search
 * GET /platform/st-courier-pincodes
 */
async function listPincodes(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      district = 'all',
      is_active,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (district && district !== 'all') {
      where.district = { [Op.iLike]: district.trim() };
    }

    if (typeof is_active !== 'undefined' && is_active !== 'all') {
      where.is_active = is_active === 'true' || is_active === true;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { pincode: { [Op.iLike]: q } },
        { district: { [Op.iLike]: q } },
        { city: { [Op.iLike]: q } },
        { hub_name: { [Op.iLike]: q } },
      ];
    }

    const { count, rows } = await StCourierServiceablePincode.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['pincode', 'ASC']],
    });

    const totalActive = await StCourierServiceablePincode.count({ where: { is_active: true } });

    // Distinct districts for filter dropdown
    const districts = await StCourierServiceablePincode.findAll({
      attributes: ['district'],
      where: { district: { [Op.ne]: null } },
      group: ['district'],
      order: [['district', 'ASC']],
      raw: true,
    }).then(list => list.map(d => d.district).filter(Boolean));

    return res.status(200).json({
      success: true,
      data: {
        pincodes: rows,
        total: count,
        totalActive,
        districts,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] listPincodes error: ${err.message}`);
    return next(err);
  }
}

/**
 * Add a single serviceable pincode
 * POST /platform/st-courier-pincodes
 */
async function addPincode(req, res, next) {
  try {
    const { pincode, district, city, hub_name, state = 'Tamil Nadu', is_active = true } = req.body;

    const cleanPin = String(pincode || '').trim();
    if (!cleanPin || !/^\d{6}$/.test(cleanPin)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid Indian pincode. Must be exactly 6 digits.' },
      });
    }

    // Auto-resolve district & city from PincodeMaster if omitted
    let resolvedDistrict = district;
    let resolvedCity = city;

    if (!resolvedDistrict || !resolvedCity) {
      try {
        const pinRecord = await PincodeMaster.findOne({ where: { pincode: cleanPin } });
        if (pinRecord) {
          resolvedDistrict = resolvedDistrict || pinRecord.district;
          resolvedCity = resolvedCity || pinRecord.city;
        } else {
          const loc = await getPincodeLocation(cleanPin);
          resolvedDistrict = resolvedDistrict || loc.district;
          resolvedCity = resolvedCity || loc.city;
        }
      } catch (e) {
        // Non-fatal
      }
    }

    const [record, created] = await StCourierServiceablePincode.findOrCreate({
      where: { pincode: cleanPin },
      defaults: {
        pincode: cleanPin,
        district: resolvedDistrict || 'Tamil Nadu',
        city: resolvedCity || 'Tamil Nadu',
        hub_name: hub_name || null,
        state: state || 'Tamil Nadu',
        is_active: is_active !== false,
      },
    });

    if (!created) {
      await record.update({
        district: resolvedDistrict || record.district,
        city: resolvedCity || record.city,
        hub_name: hub_name !== undefined ? hub_name : record.hub_name,
        is_active: is_active !== false,
      });
    }

    return res.status(200).json({
      success: true,
      message: created ? 'Pincode added successfully' : 'Pincode updated successfully',
      data: record,
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] addPincode error: ${err.message}`);
    return next(err);
  }
}

/**
 * Bulk upload serviceable pincodes via CSV rows or comma/newline-separated raw text
 * POST /platform/st-courier-pincodes/bulk
 */
async function bulkUploadPincodes(req, res, next) {
  try {
    const { items, rawText, defaultDistrict, defaultCity } = req.body;

    const toProcess = [];

    // Mode 1: Array of items [{ pincode, district, city, hub_name }]
    if (Array.isArray(items) && items.length > 0) {
      items.forEach(it => {
        const pin = String(it.pincode || it.pin || '').replace(/\D/g, '').trim();
        if (pin.length === 6) {
          toProcess.push({
            pincode: pin,
            district: it.district || it.District || defaultDistrict || null,
            city: it.city || it.City || defaultCity || null,
            hub_name: it.hub_name || it.hub || null,
          });
        }
      });
    }

    // Mode 2: Raw text pasted by user (comma, space, or newline-separated)
    if (typeof rawText === 'string' && rawText.trim()) {
      const tokens = rawText.split(/[\r\n,;\t ]+/).map(t => t.trim().replace(/\D/g, '')).filter(t => t.length === 6);
      tokens.forEach(pin => {
        toProcess.push({
          pincode: pin,
          district: defaultDistrict || null,
          city: defaultCity || null,
          hub_name: null,
        });
      });
    }

    if (toProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No valid 6-digit pincodes found in the payload.' },
      });
    }

    // Deduplicate pincodes
    const uniqueMap = new Map();
    toProcess.forEach(item => {
      if (!uniqueMap.has(item.pincode)) {
        uniqueMap.set(item.pincode, item);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    // Batch resolve missing district/city from PincodeMaster
    const allPins = uniqueList.map(u => u.pincode);
    const knownMasterRows = await PincodeMaster.findAll({
      where: { pincode: { [Op.in]: allPins } },
      attributes: ['pincode', 'district', 'city'],
      raw: true,
    }).catch(() => []);

    const masterMap = new Map();
    knownMasterRows.forEach(r => masterMap.set(r.pincode, r));

    const recordsToInsert = uniqueList.map(item => {
      const master = masterMap.get(item.pincode);
      return {
        pincode: item.pincode,
        district: item.district || master?.district || 'Tamil Nadu',
        city: item.city || master?.city || 'Tamil Nadu',
        hub_name: item.hub_name || null,
        state: 'Tamil Nadu',
        is_active: true,
      };
    });

    // Bulk upsert into database
    await StCourierServiceablePincode.bulkCreate(recordsToInsert, {
      updateOnDuplicate: ['district', 'city', 'hub_name', 'is_active', 'updated_at'],
    });

    logger.info(`[StCourierPincodeController] Successfully processed ${recordsToInsert.length} serviceable pincodes for ST Courier.`);

    const totalCount = await StCourierServiceablePincode.count({ where: { is_active: true } });

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${recordsToInsert.length} serviceable pincodes.`,
      data: {
        processedCount: recordsToInsert.length,
        totalActiveCount: totalCount,
      },
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] bulkUploadPincodes error: ${err.message}`);
    return next(err);
  }
}

/**
 * Delete a serviceable pincode
 * DELETE /platform/st-courier-pincodes/:id
 */
async function deletePincode(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await StCourierServiceablePincode.destroy({
      where: {
        [Op.or]: [{ id }, { pincode: id }],
      },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Serviceable pincode record not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Serviceable pincode deleted successfully.',
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] deletePincode error: ${err.message}`);
    return next(err);
  }
}

/**
 * Clear all serviceable pincodes
 * DELETE /platform/st-courier-pincodes
 */
async function clearAllPincodes(req, res, next) {
  try {
    await StCourierServiceablePincode.destroy({ where: {}, truncate: true });
    return res.status(200).json({
      success: true,
      message: 'All ST Courier serviceable pincodes cleared. System will now fallback to standard TN routing until replenished.',
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] clearAllPincodes error: ${err.message}`);
    return next(err);
  }
}

/**
 * Check single pincode serviceability
 * GET /platform/st-courier-pincodes/check/:pincode
 */
async function checkServiceability(req, res, next) {
  try {
    const { pincode } = req.params;
    const cleanPin = String(pincode || '').trim();

    const record = await StCourierServiceablePincode.findOne({
      where: {
        pincode: cleanPin,
        is_active: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        pincode: cleanPin,
        serviceable: !!record,
        details: record || null,
        routingTarget: record ? 'stcourier' : 'shipway',
      },
    });
  } catch (err) {
    logger.error(`[StCourierPincodeController] checkServiceability error: ${err.message}`);
    return next(err);
  }
}

module.exports = {
  listPincodes,
  addPincode,
  bulkUploadPincodes,
  deletePincode,
  clearAllPincodes,
  checkServiceability,
};
