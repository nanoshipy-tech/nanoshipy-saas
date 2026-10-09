const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const wooClient = (storeUrl, consumerKey, consumerSecret) =>
  axios.create({
    baseURL: `${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3`,
    auth: { username: consumerKey, password: consumerSecret },
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

/**
 * Validate WooCommerce credentials by calling system_status endpoint.
 */
const validateCredentials = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const client = wooClient(storeUrl, consumerKey, consumerSecret);
    const { data } = await client.get('/system_status');
    const storeName = data?.settings?.title || storeUrl;
    return { success: true, storeName };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: String(msg) };
  }
};

/**
 * Register WooCommerce webhooks.
 */
const registerWebhooks = async (connection, accessToken) => {
  // accessToken for WooCommerce = "consumerKey:::consumerSecret"
  const [ck, cs] = (accessToken || '').split(':::');
  const client = wooClient(connection.store_url, ck, cs);
  const appBaseUrl = process.env.APP_URL || 'https://api.yourdomain.com/api/v1';
  const topics = [
    { event: 'order.created', deliveryUrl: `${appBaseUrl}/api/webhooks/woocommerce/${connection.id}?topic=order.created` },
    { event: 'order.updated', deliveryUrl: `${appBaseUrl}/api/webhooks/woocommerce/${connection.id}?topic=order.updated` },
  ];
  for (const { event, deliveryUrl } of topics) {
    try {
      await client.post('/webhooks', {
        name: `Nanoshipy ${event}`,
        topic: event,
        delivery_url: deliveryUrl,
        secret: connection.webhook_secret,
        status: 'active',
      });
    } catch (err) {
      logger.warn(`[WooCommerce] Failed to register ${event}: ${err.response?.data?.message || err.message}`);
    }
  }
};

const deregisterWebhooks = async (connection, accessToken) => {
  try {
    const [ck, cs] = (accessToken || '').split(':::');
    const client = wooClient(connection.store_url, ck, cs);
    const { data } = await client.get('/webhooks', { params: { per_page: 100 } });
    const ours = (data || []).filter(w => w.delivery_url?.includes(connection.id));
    for (const w of ours) {
      await client.delete(`/webhooks/${w.id}`, { params: { force: true } });
    }
  } catch (err) {
    logger.warn(`[WooCommerce] Deregister failed: ${err.message}`);
  }
};

/**
 * Fetch WooCommerce orders since a date.
 */
const fetchOrdersSince = async (connection, accessToken, sinceDate) => {
  const [ck, cs] = (accessToken || '').split(':::');
  const client = wooClient(connection.store_url, ck, cs);
  const orders = [];
  let page = 1;
  const params = {
    per_page: 100,
    status: (connection.order_status_filter || ['processing']).join(','),
    modified_after: sinceDate ? new Date(sinceDate).toISOString() : undefined,
  };

  while (true) {
    const { data } = await client.get('/orders', { params: { ...params, page } });
    if (!data || data.length === 0) break;
    orders.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return orders;
};

/**
 * Verify inbound WooCommerce webhook (HMAC-SHA256 of raw body).
 */
const verifyWebhookSignature = (rawBody, signatureHeader, webhookSecret) => {
  const computed = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
  } catch { return false; }
};

module.exports = { validateCredentials, registerWebhooks, deregisterWebhooks, fetchOrdersSince, verifyWebhookSignature };
