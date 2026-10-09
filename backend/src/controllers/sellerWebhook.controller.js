const sellerWebhookService = require('../services/sellerWebhook.service');
const { success } = require('../utils/apiResponse');

const listWebhooks = async (req, res, next) => {
  try {
    const data = await sellerWebhookService.listWebhooks(req.tenant.id);
    return success(res, data, 200);
  } catch (err) { next(err); }
};

const createWebhook = async (req, res, next) => {
  try {
    const { url, events, description } = req.body;
    const wh = await sellerWebhookService.createWebhook(req.tenant.id, { url, events, description });
    return success(res, wh, 201);
  } catch (err) { next(err); }
};

const updateWebhook = async (req, res, next) => {
  try {
    const wh = await sellerWebhookService.updateWebhook(req.tenant.id, req.params.id, req.body);
    return success(res, wh, 200);
  } catch (err) { next(err); }
};

const deleteWebhook = async (req, res, next) => {
  try {
    await sellerWebhookService.deleteWebhook(req.tenant.id, req.params.id);
    return success(res, null, 200);
  } catch (err) { next(err); }
};

const sendTestEvent = async (req, res, next) => {
  try {
    const result = await sellerWebhookService.sendTestEvent(req.tenant.id, req.params.id);
    return success(res, result, 200);
  } catch (err) { next(err); }
};

const getDeliveryLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const data = await sellerWebhookService.getDeliveryLogs(req.tenant.id, req.params.id, parseInt(page), parseInt(limit));
    return success(res, data, 200);
  } catch (err) { next(err); }
};

module.exports = { listWebhooks, createWebhook, updateWebhook, deleteWebhook, sendTestEvent, getDeliveryLogs };
