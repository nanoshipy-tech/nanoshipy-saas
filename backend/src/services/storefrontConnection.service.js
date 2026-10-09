const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const storefrontConnectionRepo = require('../repositories/storefrontConnection.repository');
const storefrontSyncLogRepo = require('../repositories/storefrontSyncLog.repository');
const shopifyConnectorService = require('./shopifyConnector.service');
const woocommerceConnectorService = require('./woocommerceConnector.service');
const hashUtils = require('../utils/hash');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');

const CONNECTORS = {
  shopify: shopifyConnectorService,
  woocommerce: woocommerceConnectorService,
};

const getEncryptionKey = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
    throw new Error('[FATAL][Security] ENCRYPTION_KEY must be configured in production environment.');
  }
  return Buffer.from(process.env.ENCRYPTION_KEY || 'nanoshipy-default-encrypt-key-32c', 'utf8').slice(0, 32);
};

const encryptToken = (token) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptToken = (encryptedBase64) => {
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(encryptedBase64, 'base64');
    const iv = buf.slice(0, 12);
    const authTag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
};

/**
 * Connect a new storefront.
 */
const connectStorefront = async (sellerId, { platform, storeUrl, accessToken, apiSecret }) => {
  const connector = CONNECTORS[platform];
  if (!connector) throw new ValidationError(`Unsupported platform: ${platform}`);

  // Validate credentials
  const validation = await connector.validateCredentials(storeUrl, accessToken, apiSecret);
  if (!validation.success) throw new ValidationError(`Store connection failed: ${validation.error}`);

  const webhookSecret = crypto.randomBytes(32).toString('hex');

  // Check if a connection already exists for this seller and platform
  const existingConn = await storefrontConnectionRepo.findOneBySellerAndPlatform(sellerId, platform);
  let connection;

  if (existingConn) {
    connection = await storefrontConnectionRepo.update(existingConn.id, {
      store_name: validation.storeName,
      store_url: storeUrl,
      access_token_encrypted: encryptToken(accessToken),
      api_secret_encrypted: apiSecret ? encryptToken(apiSecret) : null,
      webhook_secret: existingConn.webhook_secret || webhookSecret,
      status: 'connected',
      error_message: null,
    });
  } else {
    connection = await storefrontConnectionRepo.create({
      seller_id: sellerId,
      platform,
      store_name: validation.storeName,
      store_url: storeUrl,
      access_token_encrypted: encryptToken(accessToken),
      api_secret_encrypted: apiSecret ? encryptToken(apiSecret) : null,
      webhook_secret: webhookSecret,
      status: 'connected',
    });
  }

  // Register webhooks async (non-blocking)
  setImmediate(async () => {
    try {
      await connector.registerWebhooks(connection, decryptToken(connection.access_token_encrypted));
    } catch (err) {
      logger.warn(`[Storefront] Webhook registration failed for connection ${connection.id}: ${err.message}`);
      await storefrontConnectionRepo.update(connection.id, {
        error_message: `Webhooks not registered: ${err.message}`,
      });
    }
  });

  return connection;
};

const listConnections = async (sellerId) =>
  storefrontConnectionRepo.findBySeller(sellerId);

const getConnection = async (sellerId, connectionId) => {
  const conn = await storefrontConnectionRepo.findById(connectionId);
  if (!conn || conn.seller_id !== sellerId) throw new NotFoundError('Connection not found');
  return conn;
};

const updateConnection = async (sellerId, connectionId, updates) => {
  await getConnection(sellerId, connectionId); // auth check
  return storefrontConnectionRepo.update(connectionId, updates);
};

const disconnectStorefront = async (sellerId, connectionId) => {
  const conn = await getConnection(sellerId, connectionId);
  const connector = CONNECTORS[conn.platform];
  if (connector) {
    try {
      await connector.deregisterWebhooks(conn, decryptToken(conn.access_token_encrypted));
    } catch { /* best effort */ }
  }
  await storefrontConnectionRepo.update(connectionId, { status: 'disconnected' });
};

const triggerManualSync = async (sellerId, connectionId) => {
  const conn = await getConnection(sellerId, connectionId);
  const { Queue } = require('bullmq');
  const { getRedisClient } = require('../config/redis.config');
  const queue = new Queue('storefront-order-poll', { connection: getRedisClient() });
  await queue.add('manual-sync', { connectionId: conn.id, trigger: 'manual' }, { jobId: `manual-${conn.id}-${Date.now()}` });
  return { queued: true };
};

const getSyncLogs = async (sellerId, connectionId, page = 1, limit = 20) => {
  await getConnection(sellerId, connectionId); // auth check
  return storefrontSyncLogRepo.findByConnection(connectionId, page, limit);
};

const getOrdersByConnection = async (sellerId, connectionId, page = 1, limit = 30) => {
  await getConnection(sellerId, connectionId); // ownership check
  const { Order, Shipment } = require('../models');
  const offset = (page - 1) * limit;
  const { count, rows } = await Order.findAndCountAll({
    where: { storefront_connection_id: connectionId, tenant_id: sellerId },
    include: [{
      model: Shipment,
      as: 'shipments',
      required: false,
      attributes: ['id', 'awb_number', 'status', 'courier_provider_id', 'label_url', 'created_at'],
    }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return { count, data: rows, page, limit };
};

module.exports = {
  connectStorefront,
  listConnections,
  getConnection,
  updateConnection,
  disconnectStorefront,
  triggerManualSync,
  getSyncLogs,
  getOrdersByConnection,
  decryptToken,
  encryptToken,
};
