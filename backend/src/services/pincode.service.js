'use strict';

const axios = require('axios');
const { PincodeMaster, AddressLookupAuditLog } = require('../models');
const { getRedisClient } = require('../config/redis.config');
const logger = require('../utils/logger');

const CACHE_TTL_SECONDS = 86400; // 24 Hours

/**
 * Asynchronously write lookup audit log (non-blocking).
 */
const logLookupAudit = (tenantId, pincode, source, success, errorReason = null) => {
  AddressLookupAuditLog.create({
    tenant_id: tenantId || null,
    pincode_searched: pincode,
    lookup_source: source,
    success: !!success,
    error_reason: errorReason ? String(errorReason).substring(0, 255) : null,
  }).catch((err) => {
    logger.error(`[PincodeAuditLog] Non-blocking audit log error: ${err.message}`);
  });
};

/**
 * Pincode Lookup Service
 * Search order: Redis Cache -> Local pincode_master DB -> External Fallback API (India Post) -> Not Found
 */
const lookupPincode = async (pincode, tenantId = null) => {
  const cleanPincode = String(pincode || '').trim();

  // Validate 6-digit Indian Pincode format
  if (!/^\d{6}$/.test(cleanPincode)) {
    logLookupAudit(tenantId, cleanPincode, 'none', false, 'Invalid 6-digit pincode format');
    return {
      success: false,
      data: null,
      message: 'Invalid 6-digit Indian pincode format.',
    };
  }

  const cacheKey = `pincode:lookup:${cleanPincode}`;
  const redis = getRedisClient();

  // 1. Check Redis / Mock Cache
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      logLookupAudit(tenantId, cleanPincode, parsed.source || 'pincode_master', true);
      return {
        success: true,
        data: parsed,
        cached: true,
      };
    }
  } catch (cacheErr) {
    logger.warn(`[PincodeService] Redis cache lookup warning: ${cacheErr.message}`);
  }

  // 2. Check Local pincode_master DB
  try {
    const localRecord = await PincodeMaster.findOne({
      where: { pincode: cleanPincode, is_serviceable: true },
    });

    if (localRecord) {
      const resultData = {
        pincode: localRecord.pincode,
        district: localRecord.district,
        state: localRecord.state,
        city: localRecord.city,
        is_serviceable: localRecord.is_serviceable,
        source: 'pincode_master',
      };

      // Set Cache
      redis.set(cacheKey, JSON.stringify(resultData), 'EX', CACHE_TTL_SECONDS).catch(() => {});
      logLookupAudit(tenantId, cleanPincode, 'pincode_master', true);

      return {
        success: true,
        data: resultData,
        cached: false,
      };
    }
  } catch (dbErr) {
    logger.error(`[PincodeService] Local DB lookup error: ${dbErr.message}`);
  }

  // 3. Fallback to External API (India Post Public API) if enabled or fallback permitted
  const allowExternalFallback = process.env.PINCODE_EXTERNAL_FALLBACK_ENABLED !== 'false';
  if (allowExternalFallback) {
    try {
      logger.info(`[PincodeService] Fallback to India Post API for pincode ${cleanPincode}`);
      const response = await axios.get(`https://api.postalpincode.in/pincode/${cleanPincode}`, {
        timeout: 5000,
      });

      if (response.data && Array.isArray(response.data) && response.data[0]?.Status === 'Success') {
        const postOfficeList = response.data[0].PostOffice;
        if (postOfficeList && postOfficeList.length > 0) {
          const sampleOffice = postOfficeList[0];
          const fallbackData = {
            pincode: cleanPincode,
            district: sampleOffice.District,
            state: sampleOffice.State,
            city: sampleOffice.Block !== 'NA' ? sampleOffice.Block : sampleOffice.District,
            is_serviceable: true,
            source: 'api',
          };

          // Cache fallback data & store into pincode_master async for future queries
          redis.set(cacheKey, JSON.stringify(fallbackData), 'EX', CACHE_TTL_SECONDS).catch(() => {});
          PincodeMaster.create({
            pincode: cleanPincode,
            district: fallbackData.district,
            state: fallbackData.state,
            city: fallbackData.city,
            is_serviceable: true,
            source: 'api',
          }).catch(() => {}); // Ignore duplicate insert errors

          logLookupAudit(tenantId, cleanPincode, 'api', true);

          return {
            success: true,
            data: fallbackData,
            cached: false,
          };
        }
      }
    } catch (apiErr) {
      logger.warn(`[PincodeService] India Post API fallback failed: ${apiErr.message}`);
    }
  }

  // 4. Not Found
  logLookupAudit(tenantId, cleanPincode, 'none', false, 'Pincode not found in master table or external fallback');

  return {
    success: false,
    data: null,
    message: 'Pincode details not found.',
  };
};

module.exports = {
  lookupPincode,
};
