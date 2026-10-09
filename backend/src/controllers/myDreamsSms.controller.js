'use strict';

const PlatformSetting = require('../models/platformSetting.model');
const MyDreamsSmsTemplate = require('../models/myDreamsSmsTemplate.model');
const MyDreamsSmsLog = require('../models/myDreamsSmsLog.model');
const myDreamsSms = require('../vendors/mydreams/myDreamsSms.service');
const myDreamsOtp = require('../vendors/mydreams/myDreamsOtp.service');
const logger = require('../utils/logger');

/**
 * GET /api/v1/platform/my-dreams-sms/settings
 * Retrieve My Dreams Technology configuration & templates
 */
const getSettings = async (req, res, next) => {
  try {
    const config = await myDreamsSms.getMyDreamsConfig();
    const templates = await MyDreamsSmsTemplate.findAll({
      order: [['created_at', 'ASC']],
    });

    return res.json({
      success: true,
      data: {
        enabled: config.enabled,
        api_key_masked: myDreamsSms.maskApiKey(config.apiKey),
        has_api_key: !!(config.apiKey && config.apiKey.length > 3),
        sender_id: config.senderId,
        endpoint: config.endpoint,
        templates,
      },
    });
  } catch (err) {
    logger.error(`[MyDreamsController] getSettings error: ${err.message}`);
    next(err);
  }
};

/**
 * PUT /api/v1/platform/my-dreams-sms/settings
 * Update My Dreams Technology settings & templates
 */
const updateSettings = async (req, res, next) => {
  try {
    const { enabled, api_key, sender_id, endpoint, templates } = req.body;
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;

    const saveSetting = async (key, val, type = 'string', desc = '') => {
      if (typeof val === 'undefined') return;
      const existing = await PlatformSetting.findOne({ where: { setting_key: key } });
      if (existing) {
        existing.setting_value = String(val);
        existing.updated_by = adminId;
        await existing.save();
      } else {
        await PlatformSetting.create({
          setting_key: key,
          setting_value: String(val),
          value_type: type,
          description: desc,
          updated_by: adminId,
        });
      }
    };

    if (typeof enabled !== 'undefined') {
      await saveSetting('my_dreams_sms_enabled', String(enabled), 'boolean', 'My Dreams SMS Master Enable');
    }

    if (api_key && !api_key.includes('...')) {
      await saveSetting('my_dreams_api_key', api_key.trim(), 'string', 'My Dreams SMS API Key');
    }

    if (sender_id) {
      await saveSetting('my_dreams_sender_id', sender_id.trim().toUpperCase(), 'string', 'My Dreams SMS Sender ID');
    }

    if (endpoint) {
      await saveSetting('my_dreams_endpoint', endpoint.trim(), 'string', 'My Dreams SMS Endpoint');
    }

    // Update templates if provided
    if (Array.isArray(templates)) {
      for (const t of templates) {
        if (!t.template_key) continue;
        const row = await MyDreamsSmsTemplate.findOne({ where: { template_key: t.template_key } });
        if (row) {
          if (typeof t.template_text !== 'undefined') row.template_text = t.template_text;
          if (Array.isArray(t.variable_order)) row.variable_order = t.variable_order;
          if (typeof t.dlt_template_id !== 'undefined') row.dlt_template_id = t.dlt_template_id;
          if (typeof t.is_active !== 'undefined') row.is_active = !!t.is_active;
          await row.save();
        }
      }
    }

    return getSettings(req, res, next);
  } catch (err) {
    logger.error(`[MyDreamsController] updateSettings error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v1/platform/my-dreams-sms/test
 * Send live test SMS via My Dreams Technology
 */
const testSms = async (req, res, next) => {
  try {
    const recipient_phone = req.body.recipient_phone || req.body.phone || req.body.to;
    const message = req.body.message || 'Dear Customer, your test message from Nanoshipy. Regards, My Dreams Technology Team';

    if (!recipient_phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'Recipient mobile number is required.' },
      });
    }

    const result = await myDreamsSms.sendSMS({
      to: recipient_phone,
      message,
      templateKey: 'test',
      bypassDisabledCheck: true, // Allow testing connection even when feature flag is off
    });

    if (!result.success) {
      return res.status(200).json({
        success: false,
        error: { code: 'DISPATCH_FAILED', message: result.error || 'Failed to dispatch test SMS.' },
      });
    }

    return res.json({
      success: true,
      data: {
        message: result.simulated
          ? `Test SMS simulated in Sandbox mode for ${myDreamsSms.maskPhoneNumber(recipient_phone)} (No live API key saved).`
          : `Test SMS dispatched successfully to ${myDreamsSms.maskPhoneNumber(recipient_phone)}!`,
        simulated: !!result.simulated,
        messageId: result.messageId,
      },
    });
  } catch (err) {
    logger.error(`[MyDreamsController] testSms error: ${err.message}`);
    return res.status(200).json({
      success: false,
      error: { code: 'DISPATCH_ERROR', message: err.message },
    });
  }
};

/**
 * GET /api/v1/platform/my-dreams-sms/logs
 * Retrieve paginated transmission audit logs
 */
const getLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.template_key) where.template_key = req.query.template_key;

    const { count, rows } = await MyDreamsSmsLog.findAndCountAll({
      where,
      order: [['sent_at', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total: count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (err) {
    logger.error(`[MyDreamsController] getLogs error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v1/platform/my-dreams-sms/otp/send
 * Trigger OTP dispatch via My Dreams Technology
 */
const sendOtp = async (req, res, next) => {
  try {
    const { phone, name } = req.body;
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'Phone number is required' },
      });
    }

    const result = await myDreamsOtp.sendOtp(phone, { name });
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: result.error, message: result.message },
      });
    }

    return res.json({
      success: true,
      data: {
        message: result.message,
        simulated: result.simulated,
      },
    });
  } catch (err) {
    logger.error(`[MyDreamsController] sendOtp error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v1/platform/my-dreams-sms/otp/verify
 * Verify 6-digit OTP
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Phone and OTP code are required' },
      });
    }

    const result = await myDreamsOtp.verifyOtp(phone, otp);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: { code: result.error, message: 'Invalid or expired OTP code.' },
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'OTP verified successfully.',
      },
    });
  } catch (err) {
    logger.error(`[MyDreamsController] verifyOtp error: ${err.message}`);
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  testSms,
  getLogs,
  sendOtp,
  verifyOtp,
};
