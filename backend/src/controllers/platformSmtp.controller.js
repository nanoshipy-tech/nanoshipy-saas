'use strict';

const { PlatformSetting, PlatformAuditLog } = require('../models');
const { encrypt, decrypt, maskSecret } = require('../utils/encryption.util');
const { success, error } = require('../utils/apiResponse');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_encryption',
  'smtp_username',
  'smtp_password_encrypted',
  'smtp_sender_name',
  'smtp_sender_email',
  'smtp_enabled',
];

/**
 * GET /api/v1/platform/smtp
 * Get current SMTP Configuration
 */
exports.getSmtpConfig = async (req, res) => {
  try {
    const rows = await PlatformSetting.findAll({
      where: { setting_key: SMTP_KEYS },
    });

    const configMap = {};
    rows.forEach(r => { configMap[r.setting_key] = r.setting_value; });

    let plainPassword = '';
    if (configMap.smtp_password_encrypted) {
      try {
        plainPassword = decrypt(configMap.smtp_password_encrypted) || '';
      } catch (decErr) {
        logger.warn('[PlatformSMTP] Password decrypt warning:', decErr.message);
        plainPassword = '';
      }
    }

    return success(res, {
      smtp_host: configMap.smtp_host || 'smtp.gmail.com',
      smtp_port: parseInt(configMap.smtp_port, 10) || 587,
      smtp_encryption: configMap.smtp_encryption || 'tls',
      smtp_username: configMap.smtp_username || '',
      smtp_password: plainPassword,
      smtp_password_status: (configMap.smtp_password_encrypted || plainPassword) ? 'Configured' : 'Not set',
      smtp_password_masked: maskSecret(plainPassword || configMap.smtp_password_encrypted),
      smtp_sender_name: configMap.smtp_sender_name || 'Nanoshipy Care',
      smtp_sender_email: configMap.smtp_sender_email || 'care@nanoshipy.com',
      smtp_enabled: configMap.smtp_enabled !== undefined ? (configMap.smtp_enabled === 'true' || configMap.smtp_enabled === true) : true,
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * PUT /api/v1/platform/smtp
 * Update SMTP Configuration
 */
exports.updateSmtpConfig = async (req, res) => {
  try {
    const {
      smtp_host,
      smtp_port,
      smtp_encryption,
      smtp_username,
      smtp_password,
      smtp_sender_name,
      smtp_sender_email,
      smtp_enabled,
    } = req.body;

    if (!smtp_host || !smtp_port || !smtp_sender_email) {
      return error(res, { code: 'BAD_REQUEST', message: 'SMTP Host, Port, and Sender Email are required.' }, 400);
    }

    const adminId = req.platformAdmin ? req.platformAdmin.id : null;

    const updates = [
      { key: 'smtp_host', value: String(smtp_host), type: 'string' },
      { key: 'smtp_port', value: String(smtp_port), type: 'number' },
      { key: 'smtp_encryption', value: String(smtp_encryption || 'tls'), type: 'string' },
      { key: 'smtp_username', value: String(smtp_username || ''), type: 'string' },
      { key: 'smtp_sender_name', value: String(smtp_sender_name || ''), type: 'string' },
      { key: 'smtp_sender_email', value: String(smtp_sender_email), type: 'string' },
      { key: 'smtp_enabled', value: String(Boolean(smtp_enabled)), type: 'boolean' },
    ];

    if (smtp_password && !smtp_password.startsWith('••••')) {
      const encrypted = encrypt(smtp_password);
      updates.push({ key: 'smtp_password_encrypted', value: encrypted, type: 'string' });
    }

    for (const item of updates) {
      await PlatformSetting.upsert({
        setting_key: item.key,
        setting_value: item.value,
        value_type: item.type,
        updated_by: adminId,
      });
    }

    // Write platform audit log
    if (adminId) {
      try {
        await PlatformAuditLog.create({
          platform_admin_id: adminId,
          action: 'platform_smtp_configured',
          entity_type: 'platform_setting',
          entity_id: 'smtp_config',
          metadata: { updated_by: adminId, smtp_host, smtp_port, smtp_sender_email, smtp_enabled },
          ip_address: req.ip || req.headers['x-forwarded-for'],
        });
      } catch (logErr) {
        logger.error('[PlatformSMTP] Audit log error:', logErr.message);
      }
    }

    return success(res, { message: 'SMTP Configuration updated successfully.' });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * POST /api/v1/platform/smtp/test
 * Send Test Email from UI
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const { target_email, template_name, custom_settings } = req.body;
    const recipient = target_email || (req.platformAdmin ? req.platformAdmin.email : null);

    if (!recipient) {
      return error(res, { code: 'BAD_REQUEST', message: 'Target recipient email address is required.' }, 400);
    }

    if (template_name) {
      let subject = 'Nanoshipy Sample Notification Template';
      let htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #7c3aed; margin-top: 0;">Nanoshipy Sample Template Test</h2>
          <p>This is a live test preview of template: <strong>${template_name}</strong></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
            <p style="margin: 0; font-size: 13px;"><strong>Sample Data:</strong> Order #NS-9821 | Status: Out for Delivery | AWB: 789123456</p>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">Sent from Nanoshipy Admin Dashboard.</p>
        </div>
      `;
      const sent = await emailService.sendEmail({ to: recipient, subject, htmlBody });
      if (!sent) {
        throw new Error('Failed to send template email. Please check your SMTP settings.');
      }
      return success(res, { message: `Sample template '${template_name}' sent successfully to ${recipient}!` });
    }

    const result = await emailService.verifyAndSendTestEmail(recipient, custom_settings || null);
    return success(res, {
      message: `Test email sent successfully to ${recipient}!`,
      details: result,
    });
  } catch (err) {
    let cleanMessage = err.message || 'Failed to send test email';
    if (cleanMessage.includes('535') || cleanMessage.includes('BadCredentials')) {
      cleanMessage = 'SMTP Login Failed (535 Bad Credentials): Google requires a 16-character App Password. If using Hostinger, enter your Hostinger Email Password.';
    }
    return res.status(200).json({
      success: false,
      data: null,
      error: { code: 'SMTP_TEST_FAILED', message: cleanMessage },
    });
  }
};
