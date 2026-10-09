const crypto = require('crypto');
const axios = require('axios');
const { WhatsappBspConfig } = require('../models');
const platformAuditService = require('./platformAudit.service');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');

const encryptField = (value) => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'nanoshipy-default-encrypt-key-32c', 'utf8').slice(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
};

const decryptField = (encBase64) => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'nanoshipy-default-encrypt-key-32c', 'utf8').slice(0, 32);
    const buf = Buffer.from(encBase64, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const enc = buf.slice(28);
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return d.update(enc) + d.final('utf8');
  } catch { return null; }
};

const testConnection = async (bsp, apiKey, phoneNumberId) => {
  try {
    if (bsp === 'interakt') {
      const { data } = await axios.get('https://api.interakt.ai/v1/settings/business', {
        headers: { Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}` },
        timeout: 8000,
      });
      return { success: true, display_phone_number: data?.data?.waba_phone_number || null };
    }
    if (bsp === 'gupshup') {
      await axios.get('https://api.gupshup.io/sm/api/v1/accounts', {
        headers: { apikey: apiKey },
        timeout: 8000,
      });
      return { success: true };
    }
    if (bsp === 'meta_cloud') {
      const { data } = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
        params: { fields: 'display_phone_number', access_token: apiKey },
        timeout: 8000,
      });
      return { success: true, display_phone_number: data.display_phone_number };
    }
    return { success: false, error: 'Unknown BSP' };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
};

const getConfig = async () => {
  const cfg = await WhatsappBspConfig.findOne({ order: [['created_at', 'DESC']] });
  if (!cfg) return null;
  // Never return the encrypted API key
  const { api_key_encrypted, webhook_secret_encrypted, ...safe } = cfg.toJSON();
  return { ...safe, api_key_masked: '●●●●●●●●' };
};

const saveConfig = async (adminId, { bsp, apiKey, webhookVerifyToken, webhookSecret, phoneNumberId, wabaId }) => {
  const testResult = await testConnection(bsp, apiKey, phoneNumberId);
  if (!testResult.success) {
    throw new ValidationError(`BSP connection test failed: ${testResult.error}`);
  }

  const cfg = await WhatsappBspConfig.findOne({ order: [['created_at', 'DESC']] }) || WhatsappBspConfig.build({});
  cfg.bsp = bsp;
  cfg.api_key_encrypted = encryptField(apiKey);
  cfg.webhook_verify_token = webhookVerifyToken || null;
  cfg.webhook_secret_encrypted = webhookSecret ? encryptField(webhookSecret) : null;
  cfg.phone_number_id = phoneNumberId || null;
  cfg.waba_id = wabaId || null;
  cfg.display_phone_number = testResult.display_phone_number || null;
  cfg.status = 'connected';
  cfg.last_tested_at = new Date();
  cfg.test_result = testResult;
  cfg.configured_by = adminId;
  await cfg.save();

  await platformAuditService.log({ platform_admin_id: adminId, action: 'whatsapp_bsp_configured', metadata: { bsp } });
  return getConfig();
};

const testExistingConfig = async (adminId) => {
  const cfg = await WhatsappBspConfig.findOne({ order: [['created_at', 'DESC']] });
  if (!cfg) throw new NotFoundError('No WhatsApp BSP config found');
  const apiKey = decryptField(cfg.api_key_encrypted);
  const result = await testConnection(cfg.bsp, apiKey, cfg.phone_number_id);
  cfg.last_tested_at = new Date();
  cfg.test_result = result;
  cfg.status = result.success ? 'connected' : 'error';
  await cfg.save();
  return result;
};

const disconnectConfig = async (adminId) => {
  const cfg = await WhatsappBspConfig.findOne({ order: [['created_at', 'DESC']] });
  if (!cfg) return;
  cfg.status = 'unconfigured';
  cfg.api_key_encrypted = encryptField('');
  await cfg.save();
  await platformAuditService.log({ platform_admin_id: adminId, action: 'whatsapp_bsp_disconnected' });
};

const getDecryptedApiKey = async () => {
  const cfg = await WhatsappBspConfig.findOne({ where: { status: 'connected' }, order: [['created_at', 'DESC']] });
  if (!cfg) return null;
  return decryptField(cfg.api_key_encrypted);
};

const getActiveConfig = async () => {
  const cfg = await WhatsappBspConfig.findOne({ where: { status: 'connected' }, order: [['created_at', 'DESC']] });
  if (!cfg) return null;
  return {
    bsp: cfg.bsp,
    apiKey: decryptField(cfg.api_key_encrypted),
    phoneNumberId: cfg.phone_number_id,
    wabaId: cfg.waba_id,
    displayPhoneNumber: cfg.display_phone_number,
  };
};

module.exports = { getConfig, getActiveConfig, saveConfig, testExistingConfig, disconnectConfig, getDecryptedApiKey, testConnection, decryptField };
