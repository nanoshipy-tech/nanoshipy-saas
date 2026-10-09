'use strict';

const costRateImportService = require('../services/costRateImport.service');
const { success, error } = require('../utils/apiResponse');

const importCostRates = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;

    let csvContent = '';
    if (req.file && req.file.buffer) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body && typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body && req.body.csv) {
      csvContent = req.body.csv;
    } else {
      return error(res, { code: 'BAD_REQUEST', message: 'No CSV payload or file provided for import.' }, 400);
    }

    const result = await costRateImportService.importShipwayCostCsv(csvContent, adminId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const getCostRates = async (req, res, next) => {
  try {
    const { courier, mode, zone, page, limit } = req.query;
    const result = await costRateImportService.listCostRates(
      { courier, mode, zone },
      { page, limit }
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  importCostRates,
  getCostRates,
};
