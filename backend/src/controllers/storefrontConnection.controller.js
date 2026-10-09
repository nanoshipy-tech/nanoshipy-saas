const storefrontConnectionService = require('../services/storefrontConnection.service');
const { success } = require('../utils/apiResponse');
const { ValidationError } = require('../utils/errors');

const listConnections = async (req, res, next) => {
  try {
    const data = await storefrontConnectionService.listConnections(req.tenant.id);
    return success(res, data, 200);
  } catch (err) { next(err); }
};

const connectStorefront = async (req, res, next) => {
  try {
    const { platform, store_url, access_token, api_secret } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenant_id;
    const conn = await storefrontConnectionService.connectStorefront(tenantId, {
      platform, storeUrl: store_url, accessToken: access_token, apiSecret: api_secret,
    });
    return success(res, conn, 201);
  } catch (err) { next(err); }
};

const connectShopify = async (req, res, next) => {
  try {
    const { shop_domain, access_token, webhook_secret } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenant_id;
    const shopifyIntegrationService = require('../services/shopifyIntegration.service');
    const conn = await shopifyIntegrationService.manualConnect(tenantId, {
      shop_domain,
      access_token,
      webhook_secret,
    });
    return success(res, conn, 201);
  } catch (err) { next(err); }
};

const connectWooCommerce = async (req, res, next) => {
  try {
    const { store_url, consumer_key, consumer_secret } = req.body;
    const tenantId = req.tenant?.id || req.user?.tenant_id;
    const conn = await storefrontConnectionService.connectStorefront(tenantId, {
      platform: 'woocommerce',
      storeUrl: store_url,
      accessToken: consumer_key,
      apiSecret: consumer_secret,
    });
    return success(res, conn, 201);
  } catch (err) { next(err); }
};

const getConnection = async (req, res, next) => {
  try {
    const conn = await storefrontConnectionService.getConnection(req.tenant.id, req.params.id);
    return success(res, conn, 200);
  } catch (err) { next(err); }
};

const updateConnection = async (req, res, next) => {
  try {
    const conn = await storefrontConnectionService.updateConnection(req.tenant.id, req.params.id, req.body);
    return success(res, conn, 200);
  } catch (err) { next(err); }
};

const disconnectStorefront = async (req, res, next) => {
  try {
    await storefrontConnectionService.disconnectStorefront(req.tenant.id, req.params.id);
    return success(res, null, 200);
  } catch (err) { next(err); }
};

const triggerSync = async (req, res, next) => {
  try {
    const result = await storefrontConnectionService.triggerManualSync(req.tenant.id, req.params.id);
    return success(res, result, 202);
  } catch (err) { next(err); }
};

const getSyncLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const data = await storefrontConnectionService.getSyncLogs(req.tenant.id, req.params.id, parseInt(page), parseInt(limit));
    return success(res, data, 200);
  } catch (err) { next(err); }
};

const getConnectionOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const data = await storefrontConnectionService.getOrdersByConnection(
      req.tenant.id, req.params.id, parseInt(page), parseInt(limit)
    );
    return success(res, data, 200);
  } catch (err) { next(err); }
};

module.exports = {
  listConnections,
  connectStorefront,
  connectShopify,
  connectWooCommerce,
  getConnection,
  updateConnection,
  disconnectStorefront,
  triggerSync,
  getSyncLogs,
  getConnectionOrders,
};
