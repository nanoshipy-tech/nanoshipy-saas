'use strict';

const { PincodeMaster, AddressLookupAuditLog } = require('../models');
const { parse } = require('csv-parse/sync');
const logger = require('../utils/logger');
const sequelize = require('../config/db.config');

const REQUIRED_HEADERS = ['pincode', 'district', 'state'];

/**
 * Helper to validate CSV row structure
 */
const validateRow = (row, index) => {
  const errors = [];
  const pincode = String(row.pincode || '').trim();
  const district = String(row.district || '').trim();
  const state = String(row.state || '').trim();
  const city = String(row.city || '').trim() || district;
  const is_serviceable = row.is_serviceable === false || String(row.is_serviceable).toLowerCase() === 'false' ? false : true;

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    errors.push('Pincode must be exactly 6 digits');
  }
  if (!district) {
    errors.push('District is required');
  }
  if (!state) {
    errors.push('State is required');
  }

  return {
    rowNumber: index + 1,
    data: { pincode, district, state, city, is_serviceable },
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * POST /api/v1/admin/pincode-master/preview
 * Validates uploaded CSV and returns preview with row-level error breakdown.
 */
const previewPincodes = async (req, res, next) => {
  try {
    if (!req.file && !req.body.csv_text) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'CSV file or text content is required' },
      });
    }

    const content = req.file ? req.file.buffer.toString('utf8') : req.body.csv_text;

    let records;
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CSV', message: `CSV Parsing Error: ${parseErr.message}` },
      });
    }

    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'Uploaded CSV file contains no data rows' },
      });
    }

    const headers = Object.keys(records[0]).map(h => h.toLowerCase().trim());
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_HEADERS',
          message: `Missing required CSV headers: ${missingHeaders.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`,
        },
      });
    }

    const validatedRows = records.map((row, idx) => validateRow(row, idx));
    const validCount = validatedRows.filter(r => r.isValid).length;
    const invalidCount = validatedRows.filter(r => !r.isValid).length;

    return res.status(200).json({
      success: true,
      data: {
        total_rows: records.length,
        valid_rows_count: validCount,
        invalid_rows_count: invalidCount,
        rows: validatedRows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/pincode-master/upload
 * Bulk import validated pincode rows into pincode_master (Modes: 'append' | 'replace').
 */
const uploadPincodes = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let inputRows = req.body?.rows;
    const import_mode = req.query?.mode || req.body?.import_mode || 'append';

    // If file was uploaded via multipart/form-data, parse the CSV buffer directly
    if ((!inputRows || !Array.isArray(inputRows) || inputRows.length === 0) && req.file) {
      const content = req.file.buffer.toString('utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      inputRows = records.map((r, idx) => ({ rowNumber: idx + 1, data: r }));
    }

    if (!inputRows || !Array.isArray(inputRows) || inputRows.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ROWS', message: 'No row data or CSV file provided for import' },
      });
    }

    const errorsList = [];
    const validRowsToInsert = [];

    inputRows.forEach((r, idx) => {
      const lineNum = r.rowNumber || idx + 1;
      const rowData = r.data || r;
      const validated = validateRow(rowData, idx);
      if (!validated.isValid) {
        errorsList.push({
          line: lineNum,
          pincode: rowData.pincode || 'N/A',
          errors: validated.errors,
        });
      } else {
        validRowsToInsert.push({
          pincode: validated.data.pincode,
          district: validated.data.district,
          state: validated.data.state,
          city: validated.data.city || validated.data.district,
          is_serviceable: validated.data.is_serviceable !== false,
          source: 'bulk_upload',
          line: lineNum,
        });
      }
    });

    if (errorsList.length > 0) {
      await transaction.rollback();
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: `CSV contains ${errorsList.length} invalid rows. Please correct errors before importing.`,
          details: errorsList.slice(0, 100),
          total_errors: errorsList.length,
        },
      });
    }

    if (validRowsToInsert.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: { code: 'NO_VALID_ROWS', message: 'Zero valid rows available for import' },
      });
    }

    if (import_mode === 'replace') {
      await PincodeMaster.destroy({ where: {}, transaction });
    }

    let successCount = 0;
    const insertionErrors = [];
    for (const item of validRowsToInsert) {
      try {
        const { line, ...pincodeData } = item;
        await PincodeMaster.upsert(pincodeData, { transaction });
        successCount++;
      } catch (rowErr) {
        insertionErrors.push({
          line: item.line,
          pincode: item.pincode,
          error: rowErr.message,
        });
      }
    }

    if (insertionErrors.length > 0) {
      await transaction.rollback();
      return res.status(422).json({
        success: false,
        error: {
          code: 'ROW_INSERT_ERROR',
          message: `Database error on ${insertionErrors.length} rows. Transaction rolled back.`,
          details: insertionErrors,
        },
      });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: {
        import_mode,
        total_processed: validRowsToInsert.length,
        success_count: successCount,
        inserted: successCount,
        updated: 0,
        message: `Successfully imported ${successCount} pincodes in '${import_mode}' mode.`,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/platform/pincodes
 * Manually create or update an individual location / serviceable pincode.
 */
const createPincode = async (req, res, next) => {
  try {
    const { pincode, district, state, city, is_serviceable } = req.body;
    const cleanPincode = String(pincode || '').trim();

    if (!cleanPincode || !/^\d{6}$/.test(cleanPincode)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PINCODE', message: 'Pincode must be exactly 6 digits.' },
      });
    }

    if (!district || !state) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'District and State are required fields.' },
      });
    }

    const [record] = await PincodeMaster.upsert({
      pincode: cleanPincode,
      district: String(district).trim(),
      state: String(state).trim(),
      city: String(city || district).trim(),
      is_serviceable: is_serviceable !== false,
      source: 'manual',
    });

    const redis = require('../config/redis.config').getRedisClient();
    if (redis) {
      const cacheKey = `pincode:lookup:${cleanPincode}`;
      await redis.set(cacheKey, JSON.stringify({
        pincode: cleanPincode,
        district: String(district).trim(),
        state: String(state).trim(),
        city: String(city || district).trim(),
        is_serviceable: is_serviceable !== false,
        source: 'pincode_master',
      }), 'EX', 86400).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      data: record,
      message: `Location ${cleanPincode} (${city || district}, ${state}) created successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/platform/pincodes/:pincode
 * Delete an individual location / pincode record.
 */
const deletePincode = async (req, res, next) => {
  try {
    const { pincode } = req.params;
    const cleanPincode = String(pincode || '').trim();
    const deleted = await PincodeMaster.destroy({ where: { pincode: cleanPincode } });
    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: `Pincode ${cleanPincode} not found.` } });
    }
    const redis = require('../config/redis.config').getRedisClient();
    if (redis) {
      await redis.del(`pincode:lookup:${cleanPincode}`).catch(() => {});
    }
    return res.status(200).json({ success: true, message: `Pincode ${cleanPincode} removed successfully.` });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/pincode-master
 * Search and paginate active pincode master entries.
 */
const listPincodes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const whereClause = {};
    if (search) {
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { pincode: { [Op.like]: `%${search}%` } },
        { district: { [Op.like]: `%${search}%` } },
        { state: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PincodeMaster.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['pincode', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: {
        pincodes: rows,
        pagination: {
          total: count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/pincode-master/template
 * Download sample CSV template.
 */
const downloadTemplate = (req, res) => {
  const csvContent = 'pincode,district,state,city,is_serviceable\n110001,Central Delhi,Delhi,New Delhi,true\n400001,Mumbai,Maharashtra,Mumbai,true\n560001,Bangalore,Karnataka,Bengaluru,true\n600001,Chennai,Tamil Nadu,Chennai,true\n700001,Kolkata,West Bengal,Kolkata,true\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pincode_master_sample.csv"');
  return res.status(200).send(csvContent);
};

module.exports = {
  previewPincodes,
  uploadPincodes,
  createPincode,
  deletePincode,
  listPincodes,
  downloadTemplate,
};
