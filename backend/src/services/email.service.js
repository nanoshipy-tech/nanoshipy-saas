'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption.util');

/**
 * Dynamically resolves SMTP Transporter & Sender Config from DB platform_settings or fallback env.js
 */
async function getTransporterAndSender() {
  try {
    const { PlatformSetting } = require('../models');
    const rows = await PlatformSetting.findAll({
      where: {
        setting_key: [
          'smtp_host',
          'smtp_port',
          'smtp_encryption',
          'smtp_username',
          'smtp_password_encrypted',
          'smtp_sender_name',
          'smtp_sender_email',
          'smtp_enabled',
        ],
      },
    });

    const settingsMap = {};
    rows.forEach(r => { settingsMap[r.setting_key] = r.setting_value; });

    const isEnabled = settingsMap.smtp_enabled !== undefined ? (settingsMap.smtp_enabled === 'true' || settingsMap.smtp_enabled === true) : true;
    if (!isEnabled) {
      return { enabled: false, transporter: null, from: null };
    }

    const host = settingsMap.smtp_host || config.email.host;
    const port = parseInt(settingsMap.smtp_port, 10) || config.email.port || 587;
    const encryption = settingsMap.smtp_encryption || (port === 465 ? 'ssl' : 'tls');
    const user = settingsMap.smtp_username || config.email.user;
    
    let pass = config.email.password;
    if (settingsMap.smtp_password_encrypted) {
      pass = decrypt(settingsMap.smtp_password_encrypted) || settingsMap.smtp_password_encrypted;
    }

    const senderName = settingsMap.smtp_sender_name || 'Nanoshipy Support';
    const senderEmail = settingsMap.smtp_sender_email || config.email.from;
    const fromAddress = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

    const secure = encryption === 'ssl' || port === 465;

    // Fail-fast if authentication is required but password is missing
    if (user && !pass) {
      logger.warn('[EmailService] SMTP user is configured but password is missing. Skipping email.');
      return { enabled: false, transporter: null, from: null };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 3500, // 3.5s max to establish TCP connection
      greetingTimeout: 2500,   // 2.5s max for server greeting
      socketTimeout: 5000,     // 5s max for socket activity
    });

    return { enabled: true, transporter, from: fromAddress, host, port, user };
  } catch (err) {
    logger.warn(`[EmailService] Failed to load DB SMTP settings, using env default: ${err.message}`);
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: (config.email.user && config.email.password) ? {
        user: config.email.user,
        pass: config.email.password,
      } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 3500,
      greetingTimeout: 2500,
      socketTimeout: 5000,
    });
    return { enabled: true, transporter, from: config.email.from, host: config.email.host };
  }
}

const sendEmail = async ({ to, subject, templateName, data, htmlBody, text }) => {
  try {
    const { enabled, transporter, from, host } = await getTransporterAndSender();
    if (!enabled) {
      logger.info(`[EmailService] SMTP is disabled in platform settings. Skipping email to ${to}`);
      return false;
    }

    let html = htmlBody || '';
    if (!html && templateName) {
      const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
      if (fs.existsSync(templatePath)) {
        html = fs.readFileSync(templatePath, 'utf-8');
        if (data) {
          for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            html = html.replace(regex, value);
          }
        }
      }
    }

    if (!html && text) {
      html = `<div style="font-family: Arial, sans-serif; padding: 15px; color: #1e293b; font-size: 14px;">${text}</div>`;
    }

    const mailOptions = {
      from,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] Sent email to ${to}`, { messageId: info.messageId });

    if (host && host.includes('ethereal')) {
      logger.info(`[EmailService] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return true;
  } catch (error) {
    logger.error('[EmailService] Failed to send email', { error: error.message, to, templateName });
    return false;
  }
};

/**
 * Send Test Email from UI with immediate validation
 */
const verifyAndSendTestEmail = async (targetEmail, customSettings = null) => {
  let transporter;
  let fromAddress;

  if (customSettings) {
    const { host, port, encryption, username, password, sender_name, sender_email } = customSettings;
    const secure = encryption === 'ssl' || Number(port) === 465;
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure,
      auth: username ? { user: username, pass: password } : undefined,
      tls: { rejectUnauthorized: false },
    });
    const name = sender_name || 'Nanoshipy Test';
    fromAddress = `"${name}" <${sender_email || 'noreply@nanoshipy.com'}>`;
  } else {
    const res = await getTransporterAndSender();
    if (!res.enabled || !res.transporter) {
      throw new Error('SMTP is currently disabled in platform settings.');
    }
    transporter = res.transporter;
    fromAddress = res.from;
  }

  // Verify connection first
  await transporter.verify();

  const mailOptions = {
    from: fromAddress,
    to: targetEmail,
    subject: 'Nanoshipy SMTP Configuration — Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Nanoshipy SMTP Verification Test</h2>
        <p>Congratulations! Your SMTP settings have been validated successfully.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">This is an automated test email sent from Nanoshipy Admin Panel.</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
};

module.exports = {
  sendEmail,
  verifyAndSendTestEmail,
};
