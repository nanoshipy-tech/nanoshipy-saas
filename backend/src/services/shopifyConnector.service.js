const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const SHOPIFY_API_VERSION = '2024-04';

/**
 * Extract clean Shopify host domain (e.g. store-name.myshopify.com)
 * Handles full URLs, admin URLs, protocols, and simple store slugs.
 */
const cleanShopDomain = (storeUrl) => {
  if (!storeUrl) return '';
  let domain = String(storeUrl).trim();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//i, '');
  // Remove query params and paths
  domain = domain.split('?')[0];
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  domain = domain.replace(/\/+$/, '');
  // If user entered admin URL format like admin.shopify.com/store/xyz
  if (domain.toLowerCase() === 'admin.shopify.com' && String(storeUrl).includes('/store/')) {
    const match = String(storeUrl).match(/\/store\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      domain = `${match[1]}.myshopify.com`;
    }
  }
  // If user entered just the store slug without dots (e.g. 'mystore')
  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
  }
  return domain.toLowerCase();
};

const getApiBase = (storeUrl) => {
  const host = cleanShopDomain(storeUrl);
  return `https://${host}/admin/api/${SHOPIFY_API_VERSION}`;
};

const shopifyClient = (storeUrl, accessToken) =>
  axios.create({
    baseURL: getApiBase(storeUrl),
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    timeout: 15000,
  });

/**
 * Validate Shopify credentials by fetching shop info or testing order access.
 * Gracefully falls back to /orders.json?limit=1 if token has read_orders but lacks read_shop.
 */
const validateCredentials = async (storeUrl, accessToken) => {
  const host = cleanShopDomain(storeUrl);
  if (!host) {
    return { success: false, error: 'Shopify store domain is required.' };
  }
  if (!accessToken || !accessToken.trim()) {
    return { success: false, error: 'Admin API Access Token is required.' };
  }

  let cleanToken = String(accessToken).trim();
  cleanToken = cleanToken.replace(/^Bearer\s+/i, '');
  cleanToken = cleanToken.replace(/^["']|["']$/g, '');

  logger.info(`[Shopify validateCredentials] host="${host}", tokenLen=${cleanToken.length}, tokenPrefix="${cleanToken.substring(0, 7)}", isMyshopify=${host.endsWith('.myshopify.com')}`);

  try {
    const client = shopifyClient(storeUrl, cleanToken);

    // 1. First try /shop.json to retrieve official human shop name
    try {
      const { data } = await client.get('/shop.json');
      return { success: true, storeName: data.shop?.name || host };
    } catch (shopErr) {
      // If 403 Forbidden, app may have been granted read_orders without read_shop
      if (shopErr.response?.status === 403) {
        logger.info(`[Shopify] /shop.json returned 403, validating via /orders.json fallback for ${host}`);
        try {
          await client.get('/orders.json', { params: { limit: 1, status: 'any' } });
          return { success: true, storeName: host };
        } catch (orderErr) {
          throw orderErr; // Let outer handler process actual permission/token error
        }
      }
      throw shopErr;
    }
  } catch (err) {
    logger.warn(`[Shopify validateCredentials Error] status=${err.response?.status}, data=${JSON.stringify(err.response?.data || {})}, wwwAuth=${err.response?.headers?.['www-authenticate'] || err.response?.headers?.['x-shopify-api-version'] || 'none'}`);
    let errMsg = 'Connection failed';
    if (err.response?.status === 401) {
      if (!cleanToken.startsWith('shpat_')) {
        errMsg = `Invalid token: You entered a token starting with "${cleanToken.substring(0, 6)}...". Shopify requires an Admin API Access Token (which starts with "shpat_"). Please ensure you copied the "Admin API access token" (not API Key or Secret Key) and clicked the green "Install app" button in Shopify Admin.`;
      } else if (!host.endsWith('.myshopify.com')) {
        errMsg = `Invalid credentials (401 Unauthorized). Shopify Admin API requires your permanent .myshopify.com domain (e.g. "your-store.myshopify.com"), not a custom domain like "${host}".`;
      } else {
        errMsg = `Invalid API access token (401 Unauthorized) for "${host}". Please verify: 1) The token matches this exact store. 2) The app is installed (green "Install app" button clicked in Shopify Admin). 3) The token starts with "shpat_".`;
      }
    } else if (err.response?.status === 403) {
      errMsg = 'Access denied (403 Forbidden). Ensure your custom app has "read_orders" and "write_fulfillments" (or "read_shop") permissions enabled and installed.';
    } else if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      errMsg = typeof errors === 'object' ? JSON.stringify(errors) : String(errors);
    } else if (err.code === 'ENOTFOUND') {
      errMsg = `Store domain "${host}" could not be found. Please check your .myshopify.com store address.`;
    } else {
      errMsg = err.message || 'Unknown network error';
    }
    return { success: false, error: errMsg };
  }
};

/**
 * Register Shopify webhooks for order events.
 */
const registerWebhooks = async (connection, accessToken) => {
  const client = shopifyClient(connection.store_url, accessToken);
  const appBaseUrl = process.env.APP_URL || 'https://api.nanoshipy.com';
  const webhookBase = `${appBaseUrl}/api/webhooks/shopify/${connection.id}`;
  const topics = ['orders/create', 'orders/updated', 'orders/cancelled'];

  for (const topic of topics) {
    try {
      await client.post('/webhooks.json', {
        webhook: {
          topic,
          address: `${webhookBase}?topic=${encodeURIComponent(topic)}`,
          format: 'json',
        },
      });
      logger.info(`[Shopify] Registered webhook ${topic} for connection ${connection.id}`);
    } catch (err) {
      logger.warn(`[Shopify] Failed to register ${topic}: ${err.response?.data?.errors || err.message}`);
    }
  }
};

/**
 * Deregister all webhooks for a connection (best effort).
 */
const deregisterWebhooks = async (connection, accessToken) => {
  try {
    const client = shopifyClient(connection.store_url, accessToken);
    const { data } = await client.get('/webhooks.json', { params: { limit: 250 } });
    const appBaseUrl = process.env.APP_URL || 'https://api.nanoshipy.com';
    const appBase = `${appBaseUrl}/api/webhooks/shopify/${connection.id}`;
    const ours = (data.webhooks || []).filter(w => w.address && w.address.startsWith(appBase));
    for (const w of ours) {
      await client.delete(`/webhooks/${w.id}.json`);
    }
  } catch (err) {
    logger.warn(`[Shopify] Deregister webhooks failed: ${err.message}`);
  }
};

/**
 * Fetch orders from Shopify since a given date.
 * Handles Shopify cursor pagination: when page_info is passed, other params must not be sent.
 */
const fetchOrdersSince = async (connection, accessToken, sinceDate) => {
  const client = shopifyClient(connection.store_url, accessToken);
  const orders = [];
  let pageInfo = null;

  const baseParams = {
    limit: 250,
    status: 'any',
    updated_at_min: sinceDate ? new Date(sinceDate).toISOString() : undefined,
    fields: 'id,name,line_items,shipping_address,billing_address,email,phone,financial_status,total_price,current_total_price,total_weight,created_at,updated_at',
  };

  do {
    // When page_info is provided, Shopify REST API forbids any other query params except limit
    const queryParams = pageInfo ? { limit: 250, page_info: pageInfo } : { ...baseParams };
    const { data, headers } = await client.get('/orders.json', { params: queryParams });
    orders.push(...(data.orders || []));

    // Shopify cursor pagination
    const linkHeader = headers.link || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    pageInfo = nextMatch ? nextMatch[1] : null;
  } while (pageInfo);

  return orders;
};

/**
 * Verify inbound Shopify webhook signature.
 */
const verifyWebhookSignature = (rawBody, hmacHeader, webhookSecret) => {
  const computed = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch { return false; }
};

/**
 * Push fulfillment (AWB/tracking) back to Shopify for a given order.
 * Uses Shopify's Fulfillment API v2022-07+ (fulfillment_orders flow).
 * Falls back to legacy /orders/{id}/fulfillments.json if needed.
 */
const fulfillOrder = async (connection, accessToken, shopifyOrderId, awbNumber, carrierName, trackingUrl) => {
  const client = shopifyClient(connection.store_url, accessToken);
  const host = cleanShopDomain(connection.store_url);

  logger.info(`[Shopify] Pushing fulfillment for Shopify order ${shopifyOrderId}: AWB=${awbNumber}, carrier=${carrierName}`);

  try {
    // Step 1: Get fulfillment_orders for this order
    let foData;
    try {
      const res = await client.get(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
      foData = res.data;
    } catch (foErr) {
      const status = foErr.response?.status;
      const msg = foErr.response?.data?.errors || foErr.message;
      if (status === 403 || String(msg).includes('required permission')) {
        return {
          success: false,
          error: "Shopify API Permission Denied (403): Your Shopify app is missing the 'write_fulfillments' scope. In Shopify Admin → Settings → Apps and sales channels → Develop apps → Configure Admin API integration, check 'write_fulfillments' and 'read_fulfillments', then click Save and Re-install app.",
          isScopeError: true,
          missingScope: 'write_fulfillments',
        };
      }
      throw foErr;
    }

    const fulfillmentOrders = ((foData && foData.fulfillment_orders) || []).filter(
      fo => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (fulfillmentOrders.length > 0) {
      // Modern fulfillment_orders-based API
      const lineItemsByFulfillmentOrder = fulfillmentOrders.map(fo => {
        const item = { fulfillment_order_id: fo.id };
        if (Array.isArray(fo.line_items) && fo.line_items.length > 0) {
          const fulfillableItems = fo.line_items
            .map(li => ({
              id: li.id,
              quantity: li.fulfillable_quantity !== undefined ? li.fulfillable_quantity : li.quantity,
            }))
            .filter(li => li.quantity > 0);
          if (fulfillableItems.length > 0) {
            item.fulfillment_order_line_items = fulfillableItems;
          }
        }
        return item;
      });

      const { data: fulfData } = await client.post('/fulfillments.json', {
        fulfillment: {
          message: `Shipped via ${carrierName || 'Courier'}. AWB: ${awbNumber}`,
          notify_customer: true,
          tracking_info: {
            number: String(awbNumber),
            company: carrierName || 'Courier',
            url: trackingUrl || `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`,
          },
          line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
        },
      });

      logger.info(`[Shopify] Fulfillment created for order ${shopifyOrderId} via fulfillment_orders API: ${fulfData.fulfillment?.id}`);
      return { success: true, fulfillment_id: fulfData.fulfillment?.id, fulfillmentId: fulfData.fulfillment?.id };
    }

    // Fallback: legacy /orders/{id}/fulfillments.json
    const { data: legacyData } = await client.post(`/orders/${shopifyOrderId}/fulfillments.json`, {
      fulfillment: {
        tracking_number: String(awbNumber),
        tracking_company: carrierName || 'Courier',
        tracking_url: trackingUrl || `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`,
        notify_customer: true,
      },
    });

    logger.info(`[Shopify] Fulfillment created for order ${shopifyOrderId} via legacy API: ${legacyData.fulfillment?.id}`);
    return { success: true, fulfillment_id: legacyData.fulfillment?.id, fulfillmentId: legacyData.fulfillment?.id };
  } catch (err) {
    const errMsg = err.response?.data?.errors
      ? (typeof err.response.data.errors === 'object' ? JSON.stringify(err.response.data.errors) : String(err.response.data.errors))
      : err.message;

    if (err.response?.status === 403 || /required permission/i.test(errMsg)) {
      return {
        success: false,
        error: "Shopify API Permission Denied (403): Your Shopify app is missing the 'write_fulfillments' scope. In Shopify Admin → Settings → Apps and sales channels → Develop apps → Configure Admin API integration, check 'write_fulfillments' and 'read_fulfillments', then Save and Re-install app.",
        isScopeError: true,
        missingScope: 'write_fulfillments',
      };
    }

    logger.warn(`[Shopify] fulfillOrder failed for order ${shopifyOrderId}: ${errMsg}`);
    return { success: false, error: errMsg };
  }
};

module.exports = {
  cleanShopDomain,
  getApiBase,
  validateCredentials,
  registerWebhooks,
  deregisterWebhooks,
  fetchOrdersSince,
  verifyWebhookSignature,
  fulfillOrder,
};

