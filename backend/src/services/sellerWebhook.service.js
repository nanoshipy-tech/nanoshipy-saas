const crypto = require('crypto');
const { TenantWebhook, WebhookDeliveryLog } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { Op } = require('sequelize');

const generateSecret = () => crypto.randomBytes(32).toString('hex');

const listWebhooks = async (sellerId) =>
  TenantWebhook.findAll({ where: { tenant_id: sellerId } });

const createWebhook = async (sellerId, { url, events, description }) => {
  if (!url.startsWith('https://')) throw new ValidationError('Webhook URL must use HTTPS');
  const secret = generateSecret();
  const wh = await TenantWebhook.create({
    tenant_id: sellerId,
    endpoint_url: url,
    events: events || [],
    description: description || null,
    is_active: true,
    secret: crypto.createHash('sha256').update(secret).digest('hex'),
    secret_visible_once: secret, // shown once to user, then cleared
    hmac_algorithm: 'sha256',
  });
  return { ...wh.toJSON(), secret }; // Return secret only on creation
};

const getWebhook = async (sellerId, webhookId) => {
  const wh = await TenantWebhook.findOne({ where: { id: webhookId, tenant_id: sellerId } });
  if (!wh) throw new NotFoundError('Webhook not found');
  return wh;
};

const updateWebhook = async (sellerId, webhookId, updates) => {
  const wh = await getWebhook(sellerId, webhookId);
  const allowed = ['endpoint_url', 'events', 'description', 'is_active'];
  for (const key of allowed) {
    if (updates[key] !== undefined) wh[key] = updates[key];
  }
  if (updates.endpoint_url && !updates.endpoint_url.startsWith('https://')) {
    throw new ValidationError('Webhook URL must use HTTPS');
  }
  // Clear secret_visible_once after first read
  wh.secret_visible_once = null;
  return wh.save();
};

const deleteWebhook = async (sellerId, webhookId) => {
  const wh = await getWebhook(sellerId, webhookId);
  await wh.destroy();
};

const sendTestEvent = async (sellerId, webhookId) => {
  const wh = await getWebhook(sellerId, webhookId);
  const payload = {
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test delivery from Nanoshipy', seller_id: sellerId },
  };
  const body = JSON.stringify(payload);
  const secret = wh.secret;
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  const axios = require('axios');
  try {
    const response = await axios.post(wh.endpoint_url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Nanoshipy-Signature': `sha256=${signature}`,
        'X-Nanoshipy-Event': 'test.ping',
        'X-Nanoshipy-Delivery': crypto.randomUUID(),
      },
      timeout: 10000,
    });
    return { success: true, status: response.status };
  } catch (err) {
    return { success: false, error: err.message, status: err.response?.status };
  }
};

const getDeliveryLogs = async (sellerId, webhookId, page = 1, limit = 20) => {
  const wh = await getWebhook(sellerId, webhookId);
  const offset = (page - 1) * limit;
  const { count, rows } = await WebhookDeliveryLog.findAndCountAll({
    where: { webhook_id: wh.id },
    order: [['created_at', 'DESC']],
    limit, offset,
  });
  return { total: count, page, limit, data: rows };
};

module.exports = { listWebhooks, createWebhook, getWebhook, updateWebhook, deleteWebhook, sendTestEvent, getDeliveryLogs };
