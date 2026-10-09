'use strict';

const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const rtoRecordRepository = require('../repositories/rtoRecord.repository');
const rtoService = require('../services/rto.service');

const listRtoRecords = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.query.tenant_id || null;
    const {
      status,
      tab,
      date_from,
      date_to,
      from,
      to,
      all_time,
      page = 1,
      limit = 20,
    } = req.query;

    const data = await rtoRecordRepository.findAll({
      tenant_id: tenantId,
      status,
      tab,
      date_from,
      date_to,
      from,
      to,
      all_time,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getRtoRecordDetail = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.query.tenant_id || null;
    const { id } = req.params;

    const rto = await rtoRecordRepository.findById(id, tenantId);
    if (!rto) {
      throw new NotFoundError('RTO record not found');
    }

    return success(res, rto);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await rtoService.updateRtoStatus(id, tenantId, userId, req.body);

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRtoRecords,
  getRtoRecordDetail,
  updateStatus,
};
