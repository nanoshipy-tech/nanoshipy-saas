'use strict';

const repo = require('../repositories/stCourierDistrictRate.repository');
const { success, error } = require('../utils/apiResponse');

class StCourierDistrictRateController {
  async list(req, res, next) {
    try {
      const list = await repo.listDistrictRates();
      return success(res, list);
    } catch (err) {
      next(err);
    }
  }

  async upsert(req, res, next) {
    try {
      const rate = await repo.upsertDistrictRate(req.body);
      return success(res, rate, 200);
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const ok = await repo.deleteDistrictRate(id);
      return success(res, { deleted: ok });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StCourierDistrictRateController();
