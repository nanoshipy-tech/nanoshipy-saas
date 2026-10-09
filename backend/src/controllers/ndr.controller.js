'use strict';

const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const ndrEventRepository = require('../repositories/ndrEvent.repository');
const ndrService = require('../services/ndr.service');

const listNdrEvents = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.query.tenant_id || null;
    const {
      status,
      reason_code,
      date_from,
      date_to,
      from,
      to,
      all_time,
      page = 1,
      limit = 20,
    } = req.query;

    const data = await ndrEventRepository.findAll({
      tenant_id: tenantId,
      status,
      reason_code,
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

const getNdrEventDetail = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.query.tenant_id || null;
    const { id } = req.params;

    const ndr = await ndrEventRepository.findById(id, tenantId);
    if (!ndr) {
      throw new NotFoundError('NDR event not found');
    }

    return success(res, ndr);
  } catch (err) {
    next(err);
  }
};

const takeAction = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.body?.tenant_id || null;
    const userId = req.user?.id || req.platformAdmin?.id || null;
    const { id } = req.params;

    const normalizedAction = req.body.action_type || req.body.action;
    const actionData = {
      ...req.body,
      action_type: normalizedAction === 'rto' ? 'mark_rto' : (normalizedAction === 'escalate' ? 'escalate_courier' : normalizedAction),
    };

    const isPlatformAdmin = !!req.platformAdmin || !!req.user?.isPlatformAdmin;
    const adminId = req.platformAdmin?.id || (req.user?.isPlatformAdmin ? req.user.id : null);

    const result = await ndrService.takeNdrAction(id, tenantId, userId, actionData, null, {
      isPlatformAdmin,
      adminId,
      ipAddress: req.ip,
    });

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const takeBulkAction = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.body?.tenant_id || null;
    const userId = req.user?.id || req.platformAdmin?.id || null;

    const normalizedAction = req.body.action_type || req.body.action;
    const actionData = {
      ...req.body,
      action_type: normalizedAction === 'rto' ? 'mark_rto' : (normalizedAction === 'escalate' ? 'escalate_courier' : normalizedAction),
    };

    const isPlatformAdmin = !!req.platformAdmin || !!req.user?.isPlatformAdmin;
    const adminId = req.platformAdmin?.id || (req.user?.isPlatformAdmin ? req.user.id : null);

    const result = await ndrService.takeBulkNdrAction(tenantId, userId, actionData, {
      isPlatformAdmin,
      adminId,
      ipAddress: req.ip,
    });

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.query.tenant_id || null;

    const summary = await ndrService.getNdrSummary(tenantId);

    return success(res, summary);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listNdrEvents,
  getNdrEventDetail,
  takeAction,
  takeBulkAction,
  getSummary,
};
