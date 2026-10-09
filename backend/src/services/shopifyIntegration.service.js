'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { Op } = require('sequelize');
const {
  ShopifyConnection,
  Order,
  OrderItem,
  OrderStatusHistory,
  PickupAddress,
  Shipment,
  StorefrontSyncLog,
  Tenant,
  sequelize,
} = require('../models');
const storefrontOrderMapper = require('./storefrontOrderMapper.service');
const orderService = require('./order.service');
const { getRedisClient } = require('../config/redis.config');
const eventBus = require('../events/eventBus');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../utils/errors');

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';
const DEFAULT_SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_fulfillments,write_fulfillments,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,read_shop';

// ==============================================================================
// Domain Sanitization (cleanShopDomain)
// ==============================================================================
const cleanShopDomain = (storeUrl) => {
  if (!storeUrl) return '';
  let domain = String(storeUrl).trim().toLowerCase();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//i, '');
  // Remove paths, queries, and ports
  domain = domain.split('?')[0].split('/')[0].split(':')[0].replace(/\/+$/, '');

  // Extract slug from new Shopify admin URLs (admin.shopify.com/store/xyz)
  if (domain === 'admin.shopify.com' && String(storeUrl).includes('/store/')) {
    const match = String(storeUrl).match(/\/store\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) domain = match[1] + '.myshopify.com';
  }

  // Append .myshopify.com if single slug is entered
  if (!domain.includes('.')) domain = domain + '.myshopify.com';

  return domain;
};

// ==============================================================================
// AES-256-GCM Encryption Helpers (Never store tokens in plaintext)
// ==============================================================================
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY ||
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY ||
    'nanoshipy-default-shopify-aes-key32!';
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptToken = (plainText) => {
  if (!plainText) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptToken = (encryptedBase64) => {
  if (!encryptedBase64) return null;
  // If token is already unencrypted (e.g. shpat_ or shpca_)
  if (typeof encryptedBase64 === 'string' && (encryptedBase64.startsWith('shpat_') || encryptedBase64.startsWith('shpca_'))) {
    return encryptedBase64;
  }
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(encryptedBase64, 'base64');
    if (buf.length < 28) return null;
    const iv = buf.slice(0, 12);
    const authTag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (err) {
    logger.error(`[ShopifyIntegration] Token decryption failed: ${err.message}`);
    return null;
  }
};

// ==============================================================================
// ==============================================================================
// State Nonce Generator & Verifier (Redis + Signed fallback + custom credentials)
// ==============================================================================
const generateStateNonce = async (tenantId, shopDomain, extra = {}) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadObj = {
    tenant_id: tenantId,
    shop_domain: shopDomain,
    client_id: extra.clientId || null,
    client_secret: extra.clientSecret || null,
    ts: Date.now(),
  };
  const payload = JSON.stringify(payloadObj);

  // 1. Try storing in Redis with 15-minute TTL (900 seconds)
  const redis = getRedisClient();
  if (redis && typeof redis.set === 'function') {
    try {
      await redis.set(`shopify_state:${nonce}`, payload, 'EX', 900);
    } catch (redisErr) {
      logger.warn(`[ShopifyIntegration] Redis state set warning: ${redisErr.message}`);
    }
  }

  // 2. Dual fallback: HMAC sign the state payload and include encrypted custom credentials
  const secret = process.env.JWT_ACCESS_SECRET || 'nanoshipy-state-secret-signing-key';
  const sig = crypto.createHmac('sha256', secret).update(`${nonce}:${tenantId}:${shopDomain}`).digest('hex').substring(0, 16);
  const encodedPayload = Buffer.from(JSON.stringify({
    t: tenantId,
    s: shopDomain,
    n: nonce,
    c: extra.clientId || undefined,
    cs: extra.clientSecret ? encryptToken(extra.clientSecret) : undefined,
  })).toString('base64url');

  return `${nonce}.${sig}.${encodedPayload}`;
};

const verifyStateNonce = async (stateParam) => {
  if (!stateParam) return null;
  const parts = stateParam.split('.');
  if (parts.length !== 3) return null;

  const [nonce, sig, encodedPayload] = parts;

  try {
    const raw = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    const tenantId = parsed.t;
    const shopDomain = parsed.s;

    // Cryptographically verify signature
    const secret = process.env.JWT_ACCESS_SECRET || 'nanoshipy-state-secret-signing-key';
    const expectedSig = crypto.createHmac('sha256', secret).update(`${nonce}:${tenantId}:${shopDomain}`).digest('hex').substring(0, 16);

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    let clientId = parsed.c || null;
    let clientSecret = parsed.cs ? decryptToken(parsed.cs) : null;

    // Check Redis if present to retrieve uncompressed custom credentials
    const redis = getRedisClient();
    if (redis && typeof redis.get === 'function') {
      try {
        const stored = await redis.get(`shopify_state:${nonce}`);
        if (stored) {
          const rObj = JSON.parse(stored);
          if (rObj.client_id) clientId = rObj.client_id;
          if (rObj.client_secret) clientSecret = rObj.client_secret;
        }
        await redis.del(`shopify_state:${nonce}`);
      } catch { /* ignore */ }
    }

    return {
      tenant_id: tenantId,
      shop_domain: shopDomain,
      client_id: clientId,
      client_secret: clientSecret,
    };
  } catch (err) {
    logger.warn(`[ShopifyIntegration] State verification failed: ${err.message}`);
    return null;
  }
};

// ==============================================================================
// Validate Shopify Credentials Against Admin API
// ==============================================================================
const testShopifyCredentials = async (shopDomain, accessToken) => {
  const host = cleanShopDomain(shopDomain);
  const url = `https://${host}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return { success: true, shop: response.data?.shop };
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      // If /shop.json is 403 Forbidden, app may only have read_orders scope. Test /orders.json?limit=1
      try {
        await axios.get(`https://${host}/admin/api/${SHOPIFY_API_VERSION}/orders.json`, {
          params: { limit: 1, status: 'any' },
          headers: { 'X-Shopify-Access-Token': accessToken },
          timeout: 10000,
        });
        return { success: true, shop: { name: host } };
      } catch (orderErr) {
        // Fall through to error handling below
      }
    }

    if (status === 401) {
      return {
        success: false,
        statusCode: 401,
        error: `Invalid credentials (401 Unauthorized) for "${host}". Please verify your store domain and that your Admin API access token is correct and installed in Shopify Admin.`,
      };
    }

    if (status === 403) {
      return {
        success: false,
        statusCode: 403,
        error: 'Access denied (403 Forbidden). Ensure your custom app has "read_orders" and "write_fulfillments" permissions enabled and app is installed.',
      };
    }

    if (err.code === 'ENOTFOUND') {
      return {
        success: false,
        statusCode: 404,
        error: `Store domain "${host}" could not be found. Please check your .myshopify.com store address.`,
      };
    }

    return {
      success: false,
      statusCode: status || 500,
      error: err.response?.data?.errors
        ? (typeof err.response.data.errors === 'object' ? JSON.stringify(err.response.data.errors) : String(err.response.data.errors))
        : (err.message || 'Connection failed'),
    };
  }
};

// ==============================================================================
// Webhook Registration (Shared by both OAuth & Manual paths)
// ==============================================================================
const registerWebhooks = async (connection, plainAccessToken) => {
  const host = cleanShopDomain(connection.shop_domain);
  const appBaseUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'https://api.nanoshipy.com';
  const webhookReceiverUrl = `${appBaseUrl}/api/integrations/shopify/webhooks/orders`;
  const topics = ['orders/create', 'orders/cancelled', 'orders/fulfilled'];

  let successCount = 0;
  for (const topic of topics) {
    try {
      await axios.post(
        `https://${host}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
        {
          webhook: {
            topic,
            address: `${webhookReceiverUrl}?topic=${encodeURIComponent(topic)}`,
            format: 'json',
          },
        },
        {
          headers: {
            'X-Shopify-Access-Token': plainAccessToken,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      successCount++;
      logger.info(`[ShopifyIntegration] Registered webhook "${topic}" for shop "${host}"`);
    } catch (err) {
      const errMsg = err.response?.data?.errors
        ? JSON.stringify(err.response.data.errors)
        : err.message;
      logger.warn(`[ShopifyIntegration] Webhook registration warning for "${topic}" on "${host}": ${errMsg}`);
    }
  }

  await connection.update({ webhook_registered: true });
  return { registered: true, count: successCount };
};

// ==============================================================================
// Webhook Deregistration (Best effort on disconnect)
// ==============================================================================
const deregisterWebhooks = async (connection, plainAccessToken) => {
  const host = cleanShopDomain(connection.shop_domain);
  const appBaseUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'https://api.nanoshipy.com';
  const webhookReceiverUrl = `${appBaseUrl}/api/integrations/shopify/webhooks/orders`;

  try {
    const { data } = await axios.get(
      `https://${host}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        headers: { 'X-Shopify-Access-Token': plainAccessToken },
        timeout: 10000,
      }
    );

    const webhooks = data.webhooks || [];
    const ours = webhooks.filter(w => w.address && w.address.startsWith(webhookReceiverUrl));

    for (const w of ours) {
      try {
        await axios.delete(
          `https://${host}/admin/api/${SHOPIFY_API_VERSION}/webhooks/${w.id}.json`,
          {
            headers: { 'X-Shopify-Access-Token': plainAccessToken },
            timeout: 10000,
          }
        );
      } catch { /* best effort */ }
    }
  } catch (err) {
    logger.warn(`[ShopifyIntegration] Deregister webhooks warning for ${host}: ${err.message}`);
  }
};

// ==============================================================================
// Safe Connection Representation (No plaintext tokens exposed)
// ==============================================================================
const formatConnectionResponse = (conn) => {
  if (!conn || conn.status === 'disconnected') {
    return {
      connected: false,
      status: 'disconnected',
    };
  }

  const scopesList = (conn.scopes || '').split(',').map(s => s.trim()).filter(Boolean);
  const hasWriteFulfillments = scopesList.includes('write_fulfillments');

  return {
    id: conn.id,
    tenant_id: conn.tenant_id,
    shop_domain: conn.shop_domain,
    connection_method: conn.connection_method,
    scopes: conn.scopes,
    has_write_fulfillments: hasWriteFulfillments,
    webhook_registered: conn.webhook_registered,
    status: conn.status,
    has_webhook_secret: Boolean(conn.webhook_secret),
    connected_at: conn.connected_at,
    last_synced_at: conn.last_synced_at,
    connected: conn.status === 'connected',
  };
};

// ==============================================================================
// Two-Way Fulfillment Push: Update Shopify fulfillment orders with AWB tracking
// Modern Fulfillment Orders API with graceful fallback to legacy fulfillments endpoint
// ==============================================================================
const fulfillOrder = async (connection, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl) => {
  const host = cleanShopDomain(connection.shop_domain || connection.store_url);
  const client = axios.create({
    baseURL: `https://${host}/admin/api/${SHOPIFY_API_VERSION}`,
    headers: { 'X-Shopify-Access-Token': plainToken, 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  logger.info(`[ShopifyIntegration] Pushing fulfillment for order ${shopifyOrderId}: AWB=${awbNumber}, carrier=${carrierName}`);

  try {
    let targetOrderId = String(shopifyOrderId || '').trim();

    // If order ID contains non-digits (e.g. "SHP-12345" or "#1001"), look up the numeric ID
    if (!/^\d+$/.test(targetOrderId)) {
      const cleanRef = targetOrderId.replace(/^SHP-/i, '');
      try {
        const { data: searchData } = await client.get('/orders.json', {
          params: { name: cleanRef, status: 'any', limit: 1 },
        });
        if (searchData.orders && searchData.orders.length > 0) {
          targetOrderId = String(searchData.orders[0].id);
          logger.info(`[ShopifyIntegration] Resolved order reference "${shopifyOrderId}" to Shopify numeric ID ${targetOrderId}`);
        }
      } catch (searchErr) {
        logger.warn(`[ShopifyIntegration] Failed to resolve order by name: ${searchErr.message}`);
      }
    }

    // Step 1: Fetch open fulfillment orders
    let foData;
    let foError = null;
    try {
      const res = await client.get(`/orders/${targetOrderId}/fulfillment_orders.json`);
      foData = res.data;
    } catch (foErr) {
      foError = foErr;
      const status = foErr.response?.status;
      const msg = foErr.response?.data?.errors || foErr.message;
      logger.warn(`[ShopifyIntegration] fulfillment_orders.json check for order ${targetOrderId}: status ${status} - ${JSON.stringify(msg)}`);

      // If forbidden / permissions missing, fail fast with an actionable message
      if (status === 403 || String(msg).includes('required permission')) {
        return {
          success: false,
          error: "Shopify API Permission Denied (403): Your Shopify app is missing the 'write_fulfillments' scope. In Shopify Admin → Settings → Apps and sales channels → Develop apps → Configure Admin API integration, check 'write_fulfillments' & 'read_fulfillments' under Order Fulfillment, then click Save and Re-install app.",
          isScopeError: true,
          missingScope: 'write_fulfillments',
        };
      }
    }

    const openFos = ((foData && foData.fulfillment_orders) || []).filter(
      fo => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (openFos.length > 0) {
      const lineItems = openFos.map(fo => {
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

      const { data } = await client.post('/fulfillments.json', {
        fulfillment: {
          message: `Shipped via ${carrierName || 'Courier'}. AWB: ${awbNumber}`,
          notify_customer: true,
          tracking_info: {
            number: String(awbNumber),
            company: carrierName || 'Courier',
            url: trackingUrl || `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`,
          },
          line_items_by_fulfillment_order: lineItems,
        },
      });
      logger.info(`[ShopifyIntegration] Fulfillment created via fulfillment_orders API: ${data.fulfillment?.id}`);
      return { success: true, fulfillmentId: data.fulfillment?.id, method: 'fulfillment_orders' };
    }

    // Step 2: Fallback to legacy fulfillments endpoint
    const { data: legacyData } = await client.post(`/orders/${targetOrderId}/fulfillments.json`, {
      fulfillment: {
        tracking_number: String(awbNumber),
        tracking_company: carrierName || 'Courier',
        tracking_url: trackingUrl || `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`,
        notify_customer: true,
      },
    });
    logger.info(`[ShopifyIntegration] Fulfillment created via legacy API: ${legacyData.fulfillment?.id}`);
    return { success: true, fulfillmentId: legacyData.fulfillment?.id, method: 'legacy' };
  } catch (err) {
    const errMsg = err.response?.data?.errors
      ? (typeof err.response.data.errors === 'object' ? JSON.stringify(err.response.data.errors) : String(err.response.data.errors))
      : err.message;

    // Check if order was already marked fulfilled in Shopify
    if (/already fulfilled/i.test(errMsg) || /not in an open state/i.test(errMsg) || /none of the line items/i.test(errMsg)) {
      logger.info(`[ShopifyIntegration] Order ${shopifyOrderId} is already fulfilled in Shopify.`);
      return { success: true, message: 'Order is already fulfilled in Shopify', alreadyFulfilled: true };
    }

    // Check for scope or permission error
    if (err.response?.status === 403 || /required permission/i.test(errMsg)) {
      return {
        success: false,
        error: "Shopify API Permission Denied (403): Your Shopify app is missing the 'write_fulfillments' scope. In Shopify Admin → Settings → Apps and sales channels → Develop apps → Configure Admin API integration, check 'write_fulfillments' and 'read_fulfillments', then Save and Re-install app.",
        isScopeError: true,
        missingScope: 'write_fulfillments',
      };
    }

    logger.warn(`[ShopifyIntegration] fulfillOrder failed for order ${shopifyOrderId}: ${errMsg}`);
    return { success: false, error: errMsg };
  }
};

class ShopifyIntegrationService {
  /**
   * Get current connection status for authenticated tenant
   */
  async getStatus(tenantId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId },
      order: [['updated_at', 'DESC']],
    });

    return formatConnectionResponse(connection);
  }

  /**
   * Refresh and verify active scopes directly from Shopify API
   */
  async refreshScopes(tenantId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId, status: 'connected' },
      order: [['updated_at', 'DESC']],
    });

    if (!connection) {
      throw new ValidationError('No active Shopify connection found.');
    }

    const plainToken = decryptToken(connection.access_token);
    if (!plainToken) {
      throw new ValidationError('Failed to decrypt Shopify access token.');
    }

    const host = cleanShopDomain(connection.shop_domain);
    let grantedScopes = [];
    try {
      const res = await axios.get(`https://${host}/admin/oauth/access_scopes.json`, {
        headers: { 'X-Shopify-Access-Token': plainToken },
        timeout: 10000,
      });
      grantedScopes = (res.data?.access_scopes || []).map(s => s.handle);
    } catch (err) {
      const errMsg = err.response?.data?.errors || err.message;
      const status = err.response?.status;
      if (status === 401 || /Invalid API key or access token/i.test(String(errMsg))) {
        return {
          success: false,
          isTokenInvalid: true,
          shop_domain: host,
          message: 'Your Shopify Access Token is expired or invalid. When permissions are reinstalled in Shopify, a new Admin API access token is generated. Please copy your new token from Shopify Admin → Develop apps → API credentials and update it below.',
        };
      }
      throw new ValidationError(`Failed to check scopes from Shopify: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
    }

    const hasWriteFulfillments = grantedScopes.includes('write_fulfillments');
    const scopesStr = grantedScopes.join(',');

    await connection.update({ scopes: scopesStr });

    return {
      success: true,
      shop_domain: host,
      scopes: scopesStr,
      has_write_fulfillments: hasWriteFulfillments,
      message: hasWriteFulfillments
        ? 'Shopify permissions verified successfully! "write_fulfillments" is active.'
        : 'Action Required: "write_fulfillments" is still missing in your Shopify App. In Shopify Admin → Settings → Apps and sales channels → Develop apps, check "write_fulfillments", click Save, and Re-install app.',
    };
  }

  /**
   * Option A: Build OAuth Authorize Redirect URL (Supports custom or platform Client ID)
   */
  async buildOAuthAuthorizeUrl(tenantId, rawShopDomain, customClientId, customClientSecret) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');
    if (!rawShopDomain || !String(rawShopDomain).trim()) {
      throw new ValidationError('Shopify store domain is required.');
    }

    const cleanDomain = cleanShopDomain(rawShopDomain);
    if (!cleanDomain.endsWith('.myshopify.com')) {
      throw new ValidationError(`Shopify requires your permanent ".myshopify.com" domain (e.g. "your-store.myshopify.com"), not a custom domain like "${cleanDomain}".`);
    }

    const clientId = (customClientId && String(customClientId).trim()) || process.env.SHOPIFY_CLIENT_ID;
    if (!clientId) {
      throw new ValidationError('Shopify Client ID / API Key is required. Please enter your Shopify App Client ID or connect via Option B (Manual Access Token).');
    }

    const clientSecret = (customClientSecret && String(customClientSecret).trim()) || process.env.SHOPIFY_CLIENT_SECRET;

    const appBaseUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'https://api.nanoshipy.com';
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI || `${appBaseUrl}/api/integrations/shopify/oauth/callback`;
    const scopes = DEFAULT_SCOPES;
    const stateNonce = await generateStateNonce(tenantId, cleanDomain, {
      clientId,
      clientSecret,
    });

    const authorizeUrl = `https://${cleanDomain}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateNonce)}`;

    return {
      authorize_url: authorizeUrl,
      shop_domain: cleanDomain,
      redirect_uri: redirectUri,
    };
  }

  /**
   * Option A: Handle OAuth Callback from Shopify
   */
  async handleOAuthCallback({ code, shop, state, hmac }) {
    if (!code) throw new ValidationError('Missing authorization code from Shopify.');
    if (!shop) throw new ValidationError('Missing shop parameter from Shopify.');
    if (!state) throw new ValidationError('Missing state parameter from Shopify.');

    // 1. Validate state nonce tied to tenant_id and extract custom credentials
    const stateData = await verifyStateNonce(state);
    if (!stateData || !stateData.tenant_id) {
      throw new ValidationError('OAuth authorization expired or invalid state nonce. Please initiate connection again.');
    }

    const tenantId = stateData.tenant_id;
    const cleanDomain = cleanShopDomain(shop);

    const clientId = stateData.client_id || process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = stateData.client_secret || process.env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ValidationError('Shopify Client ID and Client Secret are required to complete authorization.');
    }

    // 2. Exchange authorization code for permanent access token
    let accessToken;
    let scopesGranted;
    try {
      const tokenResponse = await axios.post(
        `https://${cleanDomain}/admin/oauth/access_token`,
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      accessToken = tokenResponse.data?.access_token;
      scopesGranted = tokenResponse.data?.scope;
    } catch (err) {
      const errMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error(`[ShopifyIntegration] OAuth token exchange failed for ${cleanDomain}: ${errMsg}`);
      throw new ValidationError(`Shopify token exchange failed: ${errMsg}`);
    }

    if (!accessToken) {
      throw new ValidationError('Shopify did not return an access token.');
    }

    // 3. Encrypt access token at rest
    const encryptedToken = encryptToken(accessToken);

    // 4. Save connection against tenant_id, saving clientSecret as webhook_secret for HMAC verification
    let connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId, shop_domain: cleanDomain },
    });

    if (connection) {
      await connection.update({
        connection_method: 'oauth',
        access_token: encryptedToken,
        scopes: scopesGranted || DEFAULT_SCOPES,
        webhook_secret: clientSecret || connection.webhook_secret,
        status: 'connected',
        connected_at: new Date(),
      });
    } else {
      connection = await ShopifyConnection.create({
        tenant_id: tenantId,
        shop_domain: cleanDomain,
        connection_method: 'oauth',
        access_token: encryptedToken,
        scopes: scopesGranted || DEFAULT_SCOPES,
        webhook_secret: clientSecret || null,
        status: 'connected',
        connected_at: new Date(),
      });
    }

    // 5. Register webhooks in background
    setImmediate(async () => {
      try {
        await registerWebhooks(connection, accessToken);
      } catch (whErr) {
        logger.warn(`[ShopifyIntegration] Background webhook registration failed: ${whErr.message}`);
      }
    });

    return formatConnectionResponse(connection);
  }

  /**
   * Option B: Manual Access Token Connection
   */
  async manualConnect(tenantId, { shop_domain, access_token, webhook_secret }) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');
    if (!shop_domain || !String(shop_domain).trim()) {
      throw new ValidationError('Shopify store domain is required.');
    }
    if (!access_token || !String(access_token).trim()) {
      throw new ValidationError('Admin API access token is required.');
    }

    const cleanDomain = cleanShopDomain(shop_domain);
    if (!cleanDomain.endsWith('.myshopify.com')) {
      throw new ValidationError(`Shopify Admin API requires your permanent ".myshopify.com" domain (e.g. "${cleanDomain.split('.')[0]}.myshopify.com"), not a custom domain like "${cleanDomain}".`);
    }

    let cleanToken = String(access_token).trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');

    // Common error safeguard: user pasted API Secret Key instead of Admin API access token
    if (cleanToken.startsWith('shpss_')) {
      throw new ValidationError('You entered an API Secret Key (shpss_...). Shopify requires an Admin API Access Token starting with "shpat_". Go to Shopify Admin → Apps → Develop apps → Your App → API credentials, click "Install app", and copy the "Admin API access token".');
    }

    if (!cleanToken.startsWith('shpat_')) {
      throw new ValidationError(`Invalid token: You entered a token starting with "${cleanToken.substring(0, 6)}...". Shopify requires an Admin API Access Token starting with "shpat_".`);
    }

    // 1. Validate credentials via lightweight authenticated endpoint
    const testResult = await testShopifyCredentials(cleanDomain, cleanToken);
    if (!testResult.success) {
      throw new ValidationError(testResult.error || 'Shopify store authentication failed.');
    }

    // 1b. Fetch active scopes directly from Shopify
    let grantedScopes = [];
    try {
      const scopeRes = await axios.get(`https://${cleanDomain}/admin/oauth/access_scopes.json`, {
        headers: { 'X-Shopify-Access-Token': cleanToken },
        timeout: 10000,
      });
      grantedScopes = (scopeRes.data?.access_scopes || []).map(s => s.handle);
    } catch {}
    const scopesStr = grantedScopes.join(',') || 'read_orders,write_orders';

    // 2. Encrypt token at rest
    const encryptedToken = encryptToken(cleanToken);

    // 3. Upsert connection record under tenant_id
    let connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId, shop_domain: cleanDomain },
    });

    if (connection) {
      await connection.update({
        connection_method: 'manual',
        access_token: encryptedToken,
        scopes: scopesStr,
        webhook_secret: webhook_secret ? String(webhook_secret).trim() : connection.webhook_secret,
        status: 'connected',
        connected_at: new Date(),
      });
    } else {
      connection = await ShopifyConnection.create({
        tenant_id: tenantId,
        shop_domain: cleanDomain,
        connection_method: 'manual',
        access_token: encryptedToken,
        scopes: scopesStr,
        webhook_secret: webhook_secret ? String(webhook_secret).trim() : null,
        status: 'connected',
        connected_at: new Date(),
      });
    }

    // 4. Register webhooks
    setImmediate(async () => {
      try {
        await registerWebhooks(connection, cleanToken);
      } catch (whErr) {
        logger.warn(`[ShopifyIntegration] Manual connection webhook registration warning: ${whErr.message}`);
      }
    });

    return formatConnectionResponse(connection);
  }

  /**
   * Disconnect Shopify store for tenant
   */
  async disconnect(tenantId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId, status: ['connected', 'token_invalid'] },
    });

    if (!connection) {
      return { success: true, message: 'No active Shopify connection found.' };
    }

    // Attempt deregistering webhooks with decrypted token
    const plainToken = decryptToken(connection.access_token);
    if (plainToken) {
      await deregisterWebhooks(connection, plainToken).catch(() => {});
    }

    await connection.update({
      status: 'disconnected',
      webhook_registered: false,
    });

    logger.info(`[ShopifyIntegration] Tenant ${tenantId} disconnected shop ${connection.shop_domain}`);
    return { success: true, message: 'Shopify store disconnected successfully.' };
  }

  /**
   * Inbound Webhook: Verify Signature and Process Orders
   */
  async verifyAndProcessWebhook({ rawBody, hmacHeader, shopDomainHeader, topicHeader, isTest = false }) {
    if (!shopDomainHeader) {
      logger.warn('[ShopifyWebhook] Missing X-Shopify-Shop-Domain header');
      return { status: 400, message: 'Missing shop domain header' };
    }

    const cleanDomain = cleanShopDomain(shopDomainHeader);

    // 1. Look up connected shop in database
    const connection = await ShopifyConnection.findOne({
      where: {
        shop_domain: cleanDomain,
        status: 'connected',
      },
    });

    if (!connection) {
      logger.warn(`[ShopifyWebhook] No connected Shopify account found for domain "${cleanDomain}"`);
      return { status: 404, message: 'Shop not connected or inactive' };
    }

    // 2. Dual HMAC verification:
    // Try custom app webhook_secret first (Option B), then app client secret (Option A), then global SHOPIFY_WEBHOOK_SECRET
    const potentialSecrets = [
      connection.webhook_secret,
      process.env.SHOPIFY_CLIENT_SECRET,
      process.env.SHOPIFY_WEBHOOK_SECRET,
    ].filter(Boolean);

    let isVerified = false;
    if (hmacHeader) {
      for (const secret of potentialSecrets) {
        const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
        try {
          if (crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader))) {
            isVerified = true;
            break;
          }
        } catch {
          // Continue checking next secret
        }
      }
    }

    if (!isVerified) {
      if (isTest) {
        logger.info(`[ShopifyWebhook] Test webhook received for "${cleanDomain}" (test header detected). Acknowledging 200 OK.`);
        return { status: 200, message: 'Shopify test webhook acknowledged successfully' };
      }
      logger.warn(`[ShopifyWebhook] HMAC signature mismatch for shop "${cleanDomain}"`);
      return { status: 401, message: 'Invalid webhook signature' };
    }

    // 3. Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch (parseErr) {
      if (isTest) {
        return { status: 200, message: 'Shopify test webhook acknowledged' };
      }
      logger.error(`[ShopifyWebhook] Invalid JSON payload from ${cleanDomain}: ${parseErr.message}`);
      return { status: 400, message: 'Invalid JSON payload' };
    }

    const topic = topicHeader || 'orders/create';
    logger.info(`[ShopifyWebhook] Verified webhook received: topic="${topic}", shop="${cleanDomain}", tenant="${connection.tenant_id}"`);

    // 4. Handle according to topic
    if (topic === 'orders/create' || topic === 'orders/updated') {
      await this.ingestOrder(connection, payload);
    } else if (topic === 'orders/cancelled') {
      await this.cancelOrder(connection, payload);
    } else if (topic === 'orders/fulfilled') {
      await this.handleOrderFulfilled(connection, payload);
    }

    await connection.update({ last_synced_at: new Date() });
    return { status: 200, message: 'Webhook processed successfully' };
  }

  /**
   * Handle order fulfilled webhook from Shopify
   */
  async handleOrderFulfilled(connection, shopifyOrder) {
    const tenantId = connection.tenant_id;
    const externalOrderId = String(shopifyOrder.id);

    const order = await Order.findOne({
      where: {
        tenant_id: tenantId,
        external_order_id: externalOrderId,
      },
    });

    if (!order) {
      logger.info(`[ShopifyIntegration] Fulfilled webhook: Order #${externalOrderId} not found for tenant ${tenantId}`);
      return;
    }

    if (order.status !== 'delivered' && order.status !== 'shipped') {
      await order.update({ status: 'shipped' });
      await OrderStatusHistory.create({
        order_id: order.id,
        old_status: order.status,
        new_status: 'shipped',
        changed_by: null,
        note: 'Marked as fulfilled in Shopify store via webhook',
      }).catch(() => {});
      logger.info(`[ShopifyIntegration] Order ${order.id} (#${externalOrderId}) marked shipped via Shopify fulfilled webhook`);
    }
  }

  /**
   * Two-Way Fulfillment Push: Update Shopify fulfillment orders with AWB tracking
   * Modern Fulfillment Orders API with graceful fallback to legacy fulfillments endpoint
   */
  async fulfillOrder(connection, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl) {
    return fulfillOrder(connection, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl);
  }

  /**
   * Push fulfillment for an order to Shopify directly (invoked from shipment workflow or user panel)
   */
  async pushOrderFulfillment(tenantId, orderId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');
    if (!orderId) throw new ValidationError('Order ID is required');

    // 1. Locate Order
    const order = await Order.findOne({
      where: {
        id: orderId,
        tenant_id: tenantId,
      },
      include: [
        { model: Shipment, as: 'shipments' },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 2. Locate active shipment with AWB
    const activeShipment = (order.shipments || []).find(s => s.awb_number && s.status !== 'cancelled') ||
      await Shipment.findOne({
        where: { order_id: order.id, status: { [Op.ne]: 'cancelled' } },
        order: [['created_at', 'DESC']],
      });

    if (!activeShipment || !activeShipment.awb_number) {
      throw new ValidationError('No active shipment with an AWB number was found for this order. Please book a shipment first.');
    }

    // 3. Locate Shopify connection
    let connection = null;
    if (order.storefront_connection_id) {
      connection = await ShopifyConnection.findByPk(order.storefront_connection_id).catch(() => null);
    }
    if (!connection) {
      connection = await ShopifyConnection.findOne({
        where: { tenant_id: tenantId, status: 'connected' },
        order: [['updated_at', 'DESC']],
      });
    }

    if (!connection || connection.status !== 'connected') {
      throw new ValidationError('No active Shopify connection found for this account. Please connect your Shopify store first.');
    }

    const plainToken = decryptToken(connection.access_token);
    if (!plainToken) {
      throw new ValidationError('Could not decrypt Shopify access token. Please reconnect your store.');
    }

    const shopifyOrderId = order.external_order_id || order.order_reference;
    const trackingUrl = `https://app.nanoshipy.com/track/${encodeURIComponent(activeShipment.awb_number)}`;
    const carrierName = 'Courier';

    const result = await fulfillOrder(
      connection,
      plainToken,
      shopifyOrderId,
      activeShipment.awb_number,
      carrierName,
      trackingUrl
    );

    if (!result.success) {
      throw new ValidationError(`Shopify fulfillment update failed: ${result.error}`);
    }

    // Record in OrderStatusHistory
    await OrderStatusHistory.create({
      order_id: order.id,
      old_status: order.status,
      new_status: order.status,
      changed_by: null,
      note: `Fulfillment pushed to Shopify (AWB: ${activeShipment.awb_number}, ID: ${result.fulfillmentId || 'confirmed'})`,
    }).catch(() => {});

    return {
      success: true,
      message: 'Fulfillment and tracking pushed to Shopify successfully!',
      fulfillmentId: result.fulfillmentId,
      awb_number: activeShipment.awb_number,
      shopify_order_id: shopifyOrderId,
    };
  }

  /**
   * On-demand manual sync for tenant
   */
  async syncOrders(tenantId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId, status: 'connected' },
      order: [['updated_at', 'DESC']],
    });

    if (!connection) {
      throw new NotFoundError('No active Shopify connection found for this tenant.');
    }

    const plainToken = decryptToken(connection.access_token);
    if (!plainToken) {
      throw new ValidationError('Could not decrypt Shopify access token. Please reconnect your store.');
    }

    const host = cleanShopDomain(connection.shop_domain);
    const client = axios.create({
      baseURL: `https://${host}/admin/api/${SHOPIFY_API_VERSION}`,
      headers: { 'X-Shopify-Access-Token': plainToken, 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let fetchedOrders = [];

    const startTime = new Date();

    try {
      const { data } = await client.get('/orders.json', {
        params: {
          limit: 50,
          status: 'any',
          fields: 'id,name,line_items,shipping_address,billing_address,email,phone,financial_status,fulfillment_status,total_price,current_total_price,total_weight,created_at,updated_at',
        },
      });

      fetchedOrders = data.orders || [];

      for (const order of fetchedOrders) {
        try {
          const res = await this.ingestOrder(connection, order);
          if (res && (res.status === 'created' || res.id)) imported++;
          else if (res && res.status === 'skipped') skipped++;
        } catch (itemErr) {
          failed++;
          logger.warn(`[ShopifyIntegration] Sync failed for order ${order.id}: ${itemErr.message}`);
        }
      }

      await connection.update({ last_synced_at: new Date() });

      if (StorefrontSyncLog) {
        await StorefrontSyncLog.create({
          storefront_connection_id: connection.id,
          trigger: 'manual',
          orders_imported: imported,
          orders_failed: failed,
          started_at: startTime,
          completed_at: new Date(),
          status: failed > 0 ? 'partial' : 'success',
          error_message: failed > 0 ? `${failed} orders failed to import` : null,
        }).catch(() => {});
      }

      return {
        success: true,
        total_fetched: fetchedOrders.length,
        imported,
        skipped,
        failed,
        last_synced_at: connection.last_synced_at,
      };
    } catch (err) {
      const errMsg = err.response?.data?.errors
        ? (typeof err.response.data.errors === 'object' ? JSON.stringify(err.response.data.errors) : String(err.response.data.errors))
        : err.message;
      logger.error(`[ShopifyIntegration] Manual sync failed for ${host}: ${errMsg}`);
      throw new ValidationError(`Shopify sync failed: ${errMsg}`);
    }
  }

  /**
   * Get orders imported for this tenant
   */
  async getOrders(tenantId, { page = 1, limit = 50 } = {}) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId },
      order: [['updated_at', 'DESC']],
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

    const whereOr = [
      { external_order_id: { [Op.ne]: null } },
      { order_reference: { [Op.like]: 'SHP-%' } },
      { order_reference: { [Op.like]: '#%' } },
    ];
    if (connection) {
      whereOr.unshift({ storefront_connection_id: connection.id });
    }

    const { count, rows } = await Order.findAndCountAll({
      where: {
        tenant_id: tenantId,
        [Op.or]: whereOr,
      },
      include: [
        {
          model: Shipment,
          as: 'shipments',
          required: false,
          attributes: ['id', 'awb_number', 'status', 'courier_provider_id', 'label_url', 'created_at'],
        },
        {
          model: OrderItem,
          as: 'items',
          required: false,
          attributes: ['id', 'product_name', 'sku', 'quantity', 'unit_price'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parsedLimit,
      offset,
    });

    return {
      count,
      data: rows,
      page: parsedPage,
      limit: parsedLimit,
    };
  }

  /**
   * Get sync and webhook logs for tenant
   */
  async getLogs(tenantId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');

    const connection = await ShopifyConnection.findOne({
      where: { tenant_id: tenantId },
      order: [['updated_at', 'DESC']],
    });

    if (!connection) {
      return { data: [] };
    }

    if (StorefrontSyncLog) {
      const logs = await StorefrontSyncLog.findAll({
        where: { storefront_connection_id: connection.id },
        order: [['created_at', 'DESC']],
        limit: 50,
      }).catch(() => []);

      if (logs && logs.length > 0) {
        return { data: logs };
      }
    }

    return {
      data: [
        {
          id: 'log-active',
          started_at: connection.last_synced_at || connection.connected_at || connection.created_at,
          trigger: connection.connection_method === 'oauth' ? 'oauth_connect' : 'token_connect',
          status: 'success',
          orders_imported: 0,
          orders_failed: 0,
          message: `Shopify store ${connection.shop_domain} active via ${connection.connection_method.toUpperCase()}`,
        },
      ],
    };
  }

  /**
   * Map and ingest order record under tenant_id, feeding into Shipway flow
   */
  async ingestOrder(connection, shopifyOrder) {
    const tenantId = connection.tenant_id;
    const externalOrderId = String(shopifyOrder.id);
    const orderReference = shopifyOrder.name ? String(shopifyOrder.name) : `SHP-${shopifyOrder.id}`;

    // 1. Idempotency check: check if order already exists for this tenant and external order ID
    const existingOrder = await Order.findOne({
      where: {
        tenant_id: tenantId,
        [Op.or]: [
          { external_order_id: externalOrderId },
          { order_reference: orderReference },
        ],
      },
    });

    if (existingOrder) {
      logger.info(`[ShopifyIntegration] Order ${orderReference} (#${externalOrderId}) already exists for tenant ${tenantId}. Skipping duplicate.`);
      return { status: 'skipped', order_id: existingOrder.id };
    }

    // 2. Map payload via storefrontOrderMapper
    const mapped = storefrontOrderMapper.fromShopify(shopifyOrder, connection.id);

    // 3. Resolve default pickup address for tenant
    let pickupAddress = await PickupAddress.findOne({
      where: { tenant_id: tenantId, is_active: true },
      order: [['is_default', 'DESC']],
    });

    if (!pickupAddress) {
      pickupAddress = await PickupAddress.create({
        tenant_id: tenantId,
        nickname: 'Primary Warehouse',
        contact_person: connection.shop_domain,
        contact_phone: '9999999999',
        address_line_1: 'Warehouse Address Pending Configuration',
        city: mapped.shipping_city || 'New Delhi',
        state: mapped.shipping_state || 'Delhi',
        pincode: mapped.shipping_pincode || '110001',
        country: 'India',
        is_default: true,
        is_active: true,
      });
    }

    // 4. Save order in database transaction
    const createdOrder = await sequelize.transaction(async (t) => {
      const order = await Order.create({
        tenant_id: tenantId,
        order_reference: orderReference,
        pickup_address_id: pickupAddress.id,
        customer_name: mapped.customer_name || 'Customer',
        customer_phone: mapped.customer_phone || '9999999999',
        customer_email: mapped.customer_email || null,
        shipping_address_line1: mapped.shipping_address_line1 || 'Address Line 1',
        shipping_address_line2: mapped.shipping_address_line2 || null,
        shipping_city: mapped.shipping_city || 'City',
        shipping_state: mapped.shipping_state || 'State',
        shipping_pincode: mapped.shipping_pincode || '110001',
        shipping_country: mapped.shipping_country || 'India',
        order_value: parseFloat(mapped.order_value || 0) || 0,
        payment_mode: mapped.payment_mode === 'cod' ? 'cod' : 'prepaid',
        cod_amount: parseFloat(mapped.cod_amount || 0) || 0,
        weight_kg: parseFloat(mapped.weight_kg || 0.5) || 0.5,
        length_cm: parseFloat(mapped.length_cm || 10) || 10,
        width_cm: parseFloat(mapped.width_cm || 10) || 10,
        height_cm: parseFloat(mapped.height_cm || 10) || 10,
        status: 'pending',
        source: 'api',
        storefront_connection_id: connection.id,
        external_order_id: externalOrderId,
      }, { transaction: t });

      let items = (mapped.items || []).map(item => ({
        order_id: order.id,
        product_name: String(item.product_name || item.name || item.title || 'Product').substring(0, 200),
        sku: item.sku ? String(item.sku).substring(0, 100) : 'SKU-DEFAULT',
        quantity: parseInt(item.quantity || 1, 10) || 1,
        unit_price: parseFloat(item.unit_price || 0) || 0,
      }));

      if (items.length === 0) {
        items = [{
          order_id: order.id,
          product_name: 'Shopify Product',
          sku: 'SKU-DEFAULT',
          quantity: 1,
          unit_price: parseFloat(mapped.order_value || 0) || 0,
        }];
      }

      await OrderItem.bulkCreate(items, { transaction: t });

      await OrderStatusHistory.create({
        order_id: order.id,
        old_status: null,
        new_status: 'pending',
        changed_by: null,
        note: `Imported via Shopify integration (${connection.connection_method})`,
      }, { transaction: t });

      return order;
    });

    // 5. Emit event to trigger Shipway routing, AWB generation, notifications, and real-time dashboard push
    setImmediate(() => {
      eventBus.emit('order.created', createdOrder);
      eventBus.emit('shopify.order_imported', {
        order_id: createdOrder.id,
        connection_id: connection.id,
        tenant_id: tenantId,
        order_reference: orderReference,
      });
    });

    logger.info(`[ShopifyIntegration] Ingested Shopify order ${orderReference} (#${externalOrderId}) as Nanoshipy Order ${createdOrder.id}`);
    return { status: 'created', order_id: createdOrder.id };
  }

  /**
   * Cancel order when cancelled in Shopify
   */
  async cancelOrder(connection, shopifyOrder) {
    const tenantId = connection.tenant_id;
    const externalOrderId = String(shopifyOrder.id);

    const order = await Order.findOne({
      where: {
        tenant_id: tenantId,
        external_order_id: externalOrderId,
      },
    });

    if (!order) {
      logger.info(`[ShopifyIntegration] Cancel webhook: Order #${externalOrderId} not found for tenant ${tenantId}`);
      return;
    }

    try {
      await orderService.cancelOrder(tenantId, order.id, null, 'Cancelled in Shopify store');
      logger.info(`[ShopifyIntegration] Order ${order.id} (#${externalOrderId}) cancelled via Shopify webhook`);
    } catch (err) {
      logger.warn(`[ShopifyIntegration] Could not cancel order ${order.id}: ${err.message}`);
    }
  }

  /**
   * Helper instance methods for token decryption/encryption
   */
  decryptToken(token) {
    return decryptToken(token);
  }

  encryptToken(token) {
    return encryptToken(token);
  }

  /**
   * Delegate fulfillOrder to standalone function
   */
  async fulfillOrder(connection, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl) {
    return fulfillOrder(connection, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl);
  }

  /**
   * Push fulfillment for an order to Shopify on demand
   */
  async pushOrderFulfillment(tenantId, orderId) {
    if (!tenantId) throw new UnauthorizedError('Tenant ID is required');
    const { Order, Shipment, CourierProvider } = require('../models');

    const order = await Order.findOne({
      where: { id: orderId, tenant_id: tenantId },
      include: [
        {
          model: Shipment,
          as: 'shipments',
          required: false,
          include: [{ model: CourierProvider, as: 'courier_provider', required: false }],
        },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const activeShipment = (order.shipments || []).find(
      s => !['cancelled', 'failed'].includes(s.status) && s.awb_number
    );

    if (!activeShipment || !activeShipment.awb_number) {
      throw new ValidationError('Order does not have an active shipment with an AWB number. Please ship the order first.');
    }

    // Locate active Shopify connection for tenant
    let conn = null;
    if (order.storefront_connection_id) {
      conn = await ShopifyConnection.findByPk(order.storefront_connection_id).catch(() => null);
    }
    if (!conn) {
      conn = await ShopifyConnection.findOne({
        where: { tenant_id: tenantId, status: 'connected' },
        order: [['updated_at', 'DESC']],
      });
    }

    if (!conn) {
      throw new ValidationError('No active Shopify connection found for this tenant.');
    }

    const plainToken = decryptToken(conn.access_token);
    if (!plainToken) {
      throw new Error('Failed to decrypt Shopify access token.');
    }

    let shopifyOrderId = order.external_order_id;
    if (!shopifyOrderId && order.order_reference) {
      const numMatch = order.order_reference.match(/^(?:SHP-)?#?(\d+)$/i);
      shopifyOrderId = numMatch ? numMatch[1] : order.order_reference;
    }

    if (!shopifyOrderId) {
      throw new ValidationError('Could not determine Shopify order ID from order.');
    }

    const awbNumber = activeShipment.awb_number;
    const carrierName = activeShipment.courier_provider?.display_name || 'Courier';
    const trackingUrl = `https://app.nanoshipy.com/track/${encodeURIComponent(awbNumber)}`;

    const result = await fulfillOrder(conn, plainToken, shopifyOrderId, awbNumber, carrierName, trackingUrl);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update fulfillment on Shopify');
    }

    return {
      success: true,
      message: result.message || `Fulfillment pushed to Shopify successfully (AWB: ${awbNumber})`,
      fulfillment_id: result.fulfillmentId,
    };
  }
}

const shopifyIntegrationService = new ShopifyIntegrationService();

module.exports = shopifyIntegrationService;
module.exports.ShopifyIntegrationService = ShopifyIntegrationService;
module.exports.cleanShopDomain = cleanShopDomain;
module.exports.encryptToken = encryptToken;
module.exports.decryptToken = decryptToken;
module.exports.generateStateNonce = generateStateNonce;
module.exports.verifyStateNonce = verifyStateNonce;
module.exports.testShopifyCredentials = testShopifyCredentials;
module.exports.fulfillOrder = fulfillOrder;

