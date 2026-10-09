'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { publicTrackingLimiter } = require('../middlewares/rateLimiter.middleware');
const { success } = require('../utils/apiResponse');
const { Tenant, User, Order, Shipment, WalletTransaction } = require('../models');
const auditService = require('../services/audit.service');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

/**
 * DPDP Act — Data Export Request
 * Authenticated seller can request their personal data export.
 * POST /api/v1/dpdp/data-export
 */
router.post('/data-export', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    logger.info(`[DPDP] Data export requested by tenant ${tenantId}, user ${userId}`);

    // Collect all data associated with the tenant
    const [tenant, users, orders, shipments, walletTxns] = await Promise.all([
      Tenant.findByPk(tenantId),
      User.findAll({ where: { tenant_id: tenantId }, attributes: { exclude: ['password_hash'] } }),
      Order.findAll({ where: { tenant_id: tenantId }, limit: 1000, order: [['created_at', 'DESC']] }),
      Shipment.findAll({ where: { tenant_id: tenantId }, limit: 1000, order: [['created_at', 'DESC']] }),
      WalletTransaction.findAll({ where: { tenant_id: tenantId }, limit: 2000, order: [['created_at', 'DESC']] }),
    ]);

    const exportPayload = {
      requested_at: new Date().toISOString(),
      tenant: tenant ? { id: tenant.id, company_name: tenant.company_name, email: tenant.email } : null,
      users: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      orders_count: orders.length,
      shipments_count: shipments.length,
      wallet_transactions_count: walletTxns.length,
      note: 'Full data export will be emailed to your registered address within 72 hours as per DPDP Act compliance.',
    };

    // Audit log the request
    await auditService.log({
      tenant_id: tenantId,
      user_id: userId,
      action: 'dpdp_data_export_requested',
      entity_type: 'tenant',
      entity_id: tenantId,
      metadata: { requested_at: exportPayload.requested_at },
    });

    // Send confirmation email
    if (tenant && tenant.email) {
      await emailService.sendEmail({
        to: tenant.email,
        subject: 'Data Export Request Received — DPDP Act Compliance',
        html: `<p>Dear ${tenant.company_name},</p><p>We have received your request for personal data export under the DPDP Act. Your data will be compiled and delivered to this email address within 72 hours.</p><p>Request ID: ${userId}-${Date.now()}</p>`,
      });
    }

    return success(res, exportPayload);
  } catch (err) {
    next(err);
  }
});

/**
 * DPDP Act — Data Deletion Request (Right to Erasure)
 * Authenticated seller requests account and data deletion.
 * POST /api/v1/dpdp/data-deletion
 */
router.post('/data-deletion', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const { reason } = req.body;

    logger.info(`[DPDP] Data deletion requested by tenant ${tenantId}, user ${userId}`);

    const tenant = await Tenant.findByPk(tenantId);

    // Audit log the deletion request
    await auditService.log({
      tenant_id: tenantId,
      user_id: userId,
      action: 'dpdp_data_deletion_requested',
      entity_type: 'tenant',
      entity_id: tenantId,
      metadata: { reason: reason || 'No reason provided', requested_at: new Date().toISOString() },
    });

    // Flag tenant as pending deletion (add a soft-delete/erasure request flag)
    // Platform admin team will review before actual deletion to comply with legal retention requirements
    await Tenant.update(
      { kyc_status: 'deletion_requested' },
      { where: { id: tenantId } }
    );

    // Send acknowledgment email
    if (tenant && tenant.email) {
      await emailService.sendEmail({
        to: tenant.email,
        subject: 'Data Deletion Request Received — DPDP Act Compliance',
        html: `<p>Dear ${tenant.company_name},</p><p>We have received your request for data deletion under the DPDP Act. Our team will review this request within 30 days. Please note that data required for legal/financial compliance will be retained as per law before deletion.</p><p>Reference: DPDP-DEL-${Date.now()}</p>`,
      });
    }

    return success(res, {
      message: 'Data deletion request received. Our team will process it within 30 days.',
      reference: `DPDP-DEL-${tenantId.substring(0, 8)}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DPDP Act — Unauthenticated data export request (e.g., buyer requesting their shipping data by AWB)
 * GET /api/v1/dpdp/buyer-data?awb=AWB123
 */
router.get('/buyer-data', publicTrackingLimiter, async (req, res, next) => {
  try {
    const { awb, phone } = req.query;

    if (!awb || !phone) {
      return res.status(400).json({
        success: false,
        error: { message: 'awb and phone are required to verify identity.' },
      });
    }

    const cleanQueryPhone = (phone || '').replace(/\D/g, '');
    if (cleanQueryPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: { message: 'A valid 10-digit phone number is required for identity verification.' },
      });
    }

    const shipment = await Shipment.findOne({
      where: { awb_number: awb },
      include: ['order'],
    });

    if (!shipment || !shipment.order) {
      return res.status(404).json({ success: false, error: { message: 'Shipment not found.' } });
    }

    // Strict identity verification — check last 10 digits of phone match
    const cleanOrderPhone = (shipment.order.shipping_phone || '').replace(/\D/g, '');
    if (!cleanOrderPhone || !cleanOrderPhone.endsWith(cleanQueryPhone.slice(-10))) {
      return res.status(403).json({ success: false, error: { message: 'Phone number does not match our records.' } });
    }

    return success(res, {
      awb_number: shipment.awb_number,
      status: shipment.status,
      estimated_delivery_date: shipment.estimated_delivery_date,
      note: 'For full data export or deletion, please contact care@nanoshipy.com',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
