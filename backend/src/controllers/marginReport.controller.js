'use strict';

const costRateSnapshotRepo = require('../repositories/costRateSnapshot.repository');
const { success } = require('../utils/apiResponse');

const getMarginReport = async (req, res, next) => {
  try {
    const { date_from, date_to, courier_id } = req.query;
    const report = await costRateSnapshotRepo.getMarginReport({ date_from, date_to, courier_id });
    return success(res, report);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMarginReport,
};
