'use strict';

const manifestService = require('../services/manifest.service');
const { success } = require('../utils/apiResponse');

const createManifest = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const result = await manifestService.createManifest(tenantId, userId, req.body);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

const getManifest = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await manifestService.getManifest(req.params.id, tenantId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const listManifests = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await manifestService.listManifests(tenantId, req.query);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createManifest,
  getManifest,
  listManifests,
};
