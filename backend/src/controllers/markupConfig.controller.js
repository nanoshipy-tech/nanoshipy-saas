'use strict';

const markupConfigService = require('../services/markupConfig.service');
const { success } = require('../utils/apiResponse');

const getMarkupConfig = async (req, res, next) => {
  try {
    const rules = await markupConfigService.getMarkupRules();
    return success(res, rules);
  } catch (err) {
    next(err);
  }
};

const createMarkupRule = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;
    const created = await markupConfigService.saveMarkupRule(req.body, adminId);
    return success(res, created, 201);
  } catch (err) {
    next(err);
  }
};

const updateMarkupRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;
    const updated = await markupConfigService.updateMarkupRule(id, req.body, adminId);
    return success(res, updated, 200);
  } catch (err) {
    next(err);
  }
};

const deleteMarkupRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await markupConfigService.deleteMarkupRule(id);
    return success(res, { message: 'Markup rule deleted successfully' }, 200);
  } catch (err) {
    next(err);
  }
};

const updateCodRtoConfig = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;
    const updated = await markupConfigService.updateCodRtoConfig(req.body, adminId);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMarkupConfig,
  createMarkupRule,
  updateMarkupRule,
  deleteMarkupRule,
  updateCodRtoConfig,
};
