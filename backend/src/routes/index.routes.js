const express = require('express');
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const platformAuthRoutes = require('./platformAuth.routes');
const impersonationRoutes = require('./impersonation.routes');
const companyProfileRoutes = require('./companyProfile.routes');
const pickupAddressRoutes = require('./pickupAddress.routes');
const orderRoutes = require('./order.routes');
const orderImportRoutes = require('./orderImport.routes');
const platformCourierRoutes = require('./courierProvider.routes');
const tenantCourierRoutes = require('./tenantCourier.routes');
const rateComparisonRoutes = require('./rateComparison.routes');
const shipmentRoutes = require('./shipment.routes');
const webhookRoutes = require('./webhook.routes');
const publicTrackingRoutes = require('./publicTracking.routes');
const platformWebhookLogRoutes = require('./platformWebhookLog.routes');
const ndrRoutes = require('./ndr.routes');
const rtoRoutes = require('./rto.routes');
const walletRoutes = require('./wallet.routes');
const rechargeRoutes = require('./recharge.routes');
const paymentWebhookRoutes = require('./paymentWebhook.routes');
const apiKeyRoutes = require('./apiKey.routes');
const tenantWebhookRoutes = require('./tenantWebhook.routes');
const publicApiRoutes = require('./publicApi.routes');
const developerApiRoutes = require('./developerApi.routes');
const tenantAnalyticsRoutes = require('./tenantAnalytics.routes');
const platformAnalyticsRoutes = require('./platformAnalytics.routes');
const reportExportRoutes = require('./reportExport.routes');
const supportTicketRoutes = require('./supportTicket.routes');
const platformTicketRoutes = require('./platformTicket.routes');

// Module 18 — Settings & Activity Logs
const tenantSettingsRoutes = require('./tenantSettings.routes');
const platformSettingsRoutes = require('./platformSettings.routes');
const activityLogRoutes = require('./activityLog.routes');
const platformActivityLogRoutes = require('./platformActivityLog.routes');
const platformTenantRoutes = require('./platformTenant.routes');

// Module 19 — SOW Gap Closure Routes
const kycRoutes = require('./kyc.routes');
const whatsappTemplateRoutes = require('./whatsappTemplate.routes');
const weightDisputeRoutes = require('./weightDispute.routes');
const subUserRoutes = require('./subUser.routes');
const carrierMarginConfigRoutes = require('./carrierMarginConfig.routes');
const pincodeRoutes = require('./pincode.routes');

const router = express.Router();

router.use('/location', pincodeRoutes);
router.use('/kyc', kycRoutes);
router.use('/whatsapp', whatsappTemplateRoutes);

router.use('/whatsapp', require('./whatsappWebhook.routes'));
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/platform/roles', require('./platformRole.routes'));
router.use('/admin/roles', require('./platformRole.routes'));
router.use('/platform/auth', platformAuthRoutes);
router.use('/platform/admin-users', platformAuthRoutes);
router.use('/platform/pincodes', require('./adminPincodeMaster.routes'));
router.use('/platform/sellers', platformTenantRoutes);
router.use('/platform/tenants', platformTenantRoutes);
router.use('/platform/impersonate', impersonationRoutes);
router.use('/platform/couriers', platformCourierRoutes);
router.use('/platform/st-courier-awb', require('./stCourierAwb.routes'));
router.use('/platform/awb-pool', require('./stCourierAwb.routes'));
router.use('/platform/st-courier-district-rates', require('./stCourierDistrictRate.routes'));
router.use('/platform/st-courier-pincodes', require('./stCourierPincode.routes'));
router.use('/company/profile', companyProfileRoutes); // Covers /profile and /documents based on routes logic
router.use('/addresses', pickupAddressRoutes);
router.use('/orders', orderImportRoutes); // Register import paths first to prevent conflict with /orders/:id
router.use('/orders', orderRoutes);
router.use('/counter-booking', require('./counterBooking.routes'));
router.use('/couriers', tenantCourierRoutes);
router.use('/rate-cards', require('./rateCard.routes'));
router.use('/', rateComparisonRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/manifests', require('./manifest.routes'));
router.use('/webhooks/inbound', webhookRoutes); // Moved to /inbound to prevent collision with tenant webhooks
router.use('/platform', require('./platformPaymentGateway.routes')); // Admin Payment Gateway config & recharge transactions

// Developer API (API Keys & Webhooks)
router.use('/api-keys', apiKeyRoutes);
router.use('/webhooks', paymentWebhookRoutes); // Public gateway webhooks (signature verified inside controller)
router.use('/webhooks', tenantWebhookRoutes);
router.use('/public', publicApiRoutes);
router.use('/v1', developerApiRoutes);

router.use('/track', publicTrackingRoutes);
router.use('/platform/webhook-logs', platformWebhookLogRoutes);
router.use('/ndr', ndrRoutes);
router.use('/rto', rtoRoutes);
router.use('/', walletRoutes);
router.use('/', require('./invoice.routes'));
router.use('/', require('./creditNote.routes'));
router.use('/', require('./codRemittance.routes'));
router.use('/', require('./subscriptionPlan.routes'));
router.use('/', require('./tenantSubscription.routes'));
router.use('/', require('./notification.routes'));
router.use('/', require('./notificationPreference.routes'));

router.use('/analytics', tenantAnalyticsRoutes);
router.use('/platform/analytics', platformAnalyticsRoutes);
router.use('/reports', reportExportRoutes);

router.use('/support', supportTicketRoutes);
router.use('/platform', platformTicketRoutes);

// Module 18 — Settings & Activity Logs
router.use('/settings', tenantSettingsRoutes);
router.use('/activity-log', activityLogRoutes);
router.use('/platform/settings', platformSettingsRoutes);
router.use('/platform/activity-log', platformActivityLogRoutes);
router.use('/platform/activity-logs', platformActivityLogRoutes);
router.use('/platform/financial-audit-logs', platformActivityLogRoutes);
router.use('/platform/security-audit-logs', platformActivityLogRoutes);

// Module 19 — G8/G9/G10 Routes
router.use('/weight-disputes', weightDisputeRoutes);
router.use('/sub-users', subUserRoutes);
router.use('/platform/carrier-margins', carrierMarginConfigRoutes);
router.use('/platform', require('./adminPincodeMaster.routes'));
router.use('/admin', require('./adminPincodeMaster.routes'));

// DPDP Act Compliance
router.use('/dpdp', require('./dpdp.routes'));

// Module 20 — Advanced Platform Layer & Module 20 Additions
router.use('/wallet/recharge', require('./tenantWalletRecharge.routes'));
router.use('/integrations/shopify', require('./shopifyIntegration.routes'));
router.use('/integrations/storefront', require('./storefrontConnection.routes'));
router.use('/platform/whatsapp', require('./whatsappBspConfig.routes'));
router.use('/platform/smtp', require('./platformSmtp.routes'));
router.use('/platform', require('./rateCard.routes'));
router.use('/platform', require('./costRateImport.routes'));
router.use('/platform', require('./markupConfig.routes'));
router.use('/platform/shipping-rules', require('./shippingAllocationRule.routes'));
router.use('/admin/shipping-rules', require('./shippingAllocationRule.routes'));
router.use('/platform', require('./marginReport.routes'));
router.use('/platform', require('./sellerWiseReport.routes'));
router.use('/seller-webhooks', require('./sellerWebhook.routes'));
router.use('/', require('./platformIntegration.routes'));
router.use('/platform/coupons', require('./platformCoupon.routes'));
router.use('/admin/coupons', require('./platformCoupon.routes'));

// Admin Dashboard & Reports
router.use('/admin/dashboard', require('./adminDashboard.routes'));
router.use('/admin/reports', require('./adminReports.routes'));
router.use('/platform/dashboard', require('./adminDashboard.routes'));
router.use('/platform/reports', require('./adminReports.routes'));
router.use('/platform/orders', require('./platformOrders.routes'));
router.use('/admin/orders', require('./platformOrders.routes'));

// Admin Exports & Webhook Engine
router.use('/admin/exports', require('./adminExport.routes'));
router.use('/platform/exports', require('./adminExport.routes'));
router.use('/admin/webhooks', require('./adminWebhook.routes'));
router.use('/platform/webhooks', require('./adminWebhook.routes'));

// Blogs & Banners API Engine
router.use('/blogs', require('./blog.routes'));
router.use('/banners', require('./banner.routes'));



// Platform nav-counts (sidebar badge polling)
router.get('/platform/nav-counts', require('../middlewares/platformAuth.middleware').isPlatformAdmin, async (req, res) => {
  try {
    const { KycDocument, NdrEvent, SupportTicket } = require('../models');
    const { Op } = require('sequelize');
    const [kyc_pending, ndr_fresh, tickets_open] = await Promise.all([
      KycDocument ? KycDocument.count({ where: { status: 'pending' } }).catch(() => 0) : 0,
      NdrEvent ? NdrEvent.count({ where: { status: 'open' } }).catch(() => 0) : 0,
      SupportTicket ? SupportTicket.count({ where: { status: { [Op.in]: ['open', 'in_progress'] } } }).catch(() => 0) : 0,
    ]);
    return res.json({ success: true, data: { kyc_pending, ndr_fresh, tickets_open } });
  } catch { return res.json({ success: true, data: { kyc_pending: 0, ndr_fresh: 0, tickets_open: 0 } }); }
});

module.exports = router;

