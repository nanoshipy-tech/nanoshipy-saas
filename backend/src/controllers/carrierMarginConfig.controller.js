'use strict';

const carrierMarginConfigService = require('../services/carrierMarginConfig.service');
const { success } = require('../utils/apiResponse');

const listConfigs = async (req, res, next) => {
  try {
    const configs = await carrierMarginConfigService.listConfigs();
    return success(res, configs);
  } catch (err) {
    next(err);
  }
};

const getConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await carrierMarginConfigService.getConfig(id);
    return success(res, config);
  } catch (err) {
    next(err);
  }
};

const createConfig = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin.id;
    const config = await carrierMarginConfigService.createConfig(adminId, req.body);
    return success(res, config, 201);
  } catch (err) {
    next(err);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await carrierMarginConfigService.updateConfig(id, req.body);
    return success(res, config);
  } catch (err) {
    next(err);
  }
};

module.exports = { listConfigs, getConfig, createConfig, updateConfig };
