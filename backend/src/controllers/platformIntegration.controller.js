'use strict';

const platformIntegrationService = require('../services/platformIntegration.service');
const customerDatabaseReportService = require('../services/customerDatabaseReport.service');
const customerLogisticsReportService = require('../services/customerLogisticsReport.service');
const { success } = require('../utils/apiResponse');

const listCatalogue = async (req, res, next) => {
  try {
    const list = await platformIntegrationService.listCatalogue();
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

const toggleGlobal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const updated = await platformIntegrationService.toggleIntegrationGlobal(id, is_active);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

const getTenantConfigs = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const configs = await platformIntegrationService.getTenantConfigs(tenantId);
    return success(res, configs);
  } catch (err) {
    next(err);
  }
};

const saveTenantConfig = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const config = await platformIntegrationService.saveTenantConfig(tenantId, req.body);
    return success(res, config);
  } catch (err) {
    next(err);
  }
};

const syncOrders = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const { configId } = req.params;
    const result = await platformIntegrationService.syncStoreOrders(tenantId, configId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

// Reports
const getCustomerDatabaseReport = async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const data = await customerDatabaseReportService.generateReport({ format });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="customer_database_report.csv"');
      return res.send(data);
    }
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getCustomerLogisticsReport = async (req, res, next) => {
  try {
    const { tenant_id, date_from, date_to, format } = req.query;
    const data = await customerLogisticsReportService.generateReport({ tenant_id, date_from, date_to, format });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="customer_logistics_report.csv"');
      return res.send(data);
    }
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listCatalogue,
  toggleGlobal,
  getTenantConfigs,
  saveTenantConfig,
  syncOrders,
  getCustomerDatabaseReport,
  getCustomerLogisticsReport,
};
