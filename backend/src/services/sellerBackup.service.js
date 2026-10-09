'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  Tenant,
  User,
  Role,
  PickupAddress,
  CompanyDocument,
  KycDocument,
  Order,
  OrderItem,
  OrderStatusHistory,
  OrderImport,
  Shipment,
  ShipmentStatusHistory,
  TrackingEvent,
  ShipmentRateQuote,
  Manifest,
  NdrEvent,
  NdrAction,
  RtoRecord,
  Wallet,
  WalletTransaction,
  WalletAdjustment,
  RechargeOrder,
  WalletRechargeTransaction,
  Invoice,
  InvoiceLineItem,
  CreditNote,
  PostpaidInvoice,
  PostpaidPayment,
  PostpaidTransaction,
  SellerPaymentProfile,
  SellerPaymentTermsHistory,
  ShopifyConnection,
  StorefrontConnection,
  StorefrontSyncLog,
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  TenantSetting,
  SettingsChangeHistory,
  ApiKey,
  ApiKeyUsageLog,
  TenantWebhook,
  WebhookDelivery,
  TenantSubscription,
  PlanUsageTracking,
  PlanChangeHistory,
  PlatformAuditLog,
  CodRemittance,
  WeightDiscrepancyDispute,
  SubUser,
} = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

// Ensure local backup directory exists
const BACKUP_DIR = path.join(__dirname, '..', '..', 'storage', 'backups', 'sellers');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

class SellerBackupService {
  /**
   * Get pre-flight risk assessment and record counts before deletion
   */
  async getPreDeleteStats(tenantId) {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      throw new NotFoundError('Seller account not found');
    }

    const [
      ordersCount,
      shipmentsCount,
      usersCount,
      wallet,
      activeShipments,
      postpaidProfile,
    ] = await Promise.all([
      Order.count({ where: { tenant_id: tenantId } }).catch(() => 0),
      Shipment.count({ where: { tenant_id: tenantId } }).catch(() => 0),
      User.count({ where: { tenant_id: tenantId } }).catch(() => 0),
      Wallet.findOne({ where: { tenant_id: tenantId } }).catch(() => null),
      Shipment.count({
        where: {
          tenant_id: tenantId,
          status: { [Op.in]: ['in_transit', 'out_for_delivery', 'pickup_scheduled', 'booked'] },
        },
      }).catch(() => 0),
      SellerPaymentProfile ? SellerPaymentProfile.findOne({ where: { tenant_id: tenantId } }).catch(() => null) : null,
    ]);

    return {
      tenant_id: tenant.id,
      company_name: tenant.company_name,
      subdomain: tenant.subdomain,
      status: tenant.status,
      created_at: tenant.createdAt || tenant.created_at,
      stats: {
        orders_count: ordersCount,
        shipments_count: shipmentsCount,
        users_count: usersCount,
        active_shipments: activeShipments,
        wallet_balance: wallet ? parseFloat(wallet.balance || 0) : 0,
        postpaid_billing_type: postpaidProfile?.billing_type || 'prepaid',
        outstanding_balance: postpaidProfile ? parseFloat(postpaidProfile.outstanding_balance || 0) : 0,
      },
      has_active_shipments: activeShipments > 0,
      has_unpaid_dues: postpaidProfile ? parseFloat(postpaidProfile.outstanding_balance || 0) > 0 : false,
    };
  }

  /**
   * Extract all database records for a tenant into a structured JSON payload
   */
  async extractSellerData(tenantId) {
    const tenant = await Tenant.findByPk(tenantId, { raw: true });
    if (!tenant) {
      throw new NotFoundError('Seller account not found');
    }

    // Helper to safely query a model
    const safeQuery = async (model, where = { tenant_id: tenantId }) => {
      if (!model) return [];
      try {
        return await model.findAll({ where, raw: true });
      } catch (err) {
        logger.warn(`[SellerBackup] Table extraction warning for ${model.tableName || model.name}: ${err.message}`);
        return [];
      }
    };

    // 1. Direct tenant-scoped models
    const [
      users,
      pickupAddresses,
      companyDocuments,
      kycDocuments,
      orders,
      shipments,
      wallets,
      invoices,
      shopifyConnections,
      storefrontConnections,
      storefrontSyncLogs,
      supportTickets,
      tenantSettings,
      settingsHistories,
      apiKeys,
      tenantWebhooks,
      tenantSubscriptions,
      planUsage,
      planHistory,
      codRemittances,
      weightDisputes,
      subUsers,
      paymentProfile,
    ] = await Promise.all([
      safeQuery(User),
      safeQuery(PickupAddress),
      safeQuery(CompanyDocument),
      safeQuery(KycDocument),
      safeQuery(Order),
      safeQuery(Shipment),
      safeQuery(Wallet),
      safeQuery(Invoice),
      safeQuery(ShopifyConnection),
      safeQuery(StorefrontConnection),
      safeQuery(StorefrontSyncLog),
      safeQuery(SupportTicket),
      safeQuery(TenantSetting),
      safeQuery(SettingsChangeHistory),
      safeQuery(ApiKey),
      safeQuery(TenantWebhook),
      safeQuery(TenantSubscription),
      safeQuery(PlanUsageTracking),
      safeQuery(PlanChangeHistory),
      safeQuery(CodRemittance),
      safeQuery(WeightDiscrepancyDispute),
      safeQuery(SubUser),
      safeQuery(SellerPaymentProfile),
    ]);

    // 2. Child models linked via IDs
    const orderIds = orders.map(o => o.id);
    const shipmentIds = shipments.map(s => s.id);
    const walletIds = wallets.map(w => w.id);
    const invoiceIds = invoices.map(i => i.id);
    const ticketIds = supportTickets.map(t => t.id);

    const [
      orderItems,
      orderStatusHistories,
      shipmentRateQuotes,
      shipmentStatusHistories,
      trackingEvents,
      ndrEvents,
      rtoRecords,
      walletTransactions,
      walletAdjustments,
      rechargeOrders,
      invoiceLineItems,
      creditNotes,
      postpaidInvoices,
      postpaidPayments,
      postpaidTransactions,
      ticketMessages,
      ticketAttachments,
    ] = await Promise.all([
      orderIds.length > 0 ? safeQuery(OrderItem, { order_id: { [Op.in]: orderIds } }) : [],
      orderIds.length > 0 ? safeQuery(OrderStatusHistory, { order_id: { [Op.in]: orderIds } }) : [],
      orderIds.length > 0 ? safeQuery(ShipmentRateQuote, { order_id: { [Op.in]: orderIds } }) : [],
      shipmentIds.length > 0 ? safeQuery(ShipmentStatusHistory, { shipment_id: { [Op.in]: shipmentIds } }) : [],
      shipmentIds.length > 0 ? safeQuery(TrackingEvent, { shipment_id: { [Op.in]: shipmentIds } }) : [],
      shipmentIds.length > 0 ? safeQuery(NdrEvent, { shipment_id: { [Op.in]: shipmentIds } }) : [],
      shipmentIds.length > 0 ? safeQuery(RtoRecord, { shipment_id: { [Op.in]: shipmentIds } }) : [],
      walletIds.length > 0 ? safeQuery(WalletTransaction, { wallet_id: { [Op.in]: walletIds } }) : [],
      safeQuery(WalletAdjustment),
      safeQuery(RechargeOrder),
      invoiceIds.length > 0 ? safeQuery(InvoiceLineItem, { invoice_id: { [Op.in]: invoiceIds } }) : [],
      invoiceIds.length > 0 ? safeQuery(CreditNote, { invoice_id: { [Op.in]: invoiceIds } }) : [],
      safeQuery(PostpaidInvoice),
      safeQuery(PostpaidPayment),
      safeQuery(PostpaidTransaction),
      ticketIds.length > 0 ? safeQuery(TicketMessage, { ticket_id: { [Op.in]: ticketIds } }) : [],
      ticketIds.length > 0 ? safeQuery(TicketAttachment, { ticket_id: { [Op.in]: ticketIds } }) : [],
    ]);

    return {
      backup_version: '1.0.0',
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      company_name: tenant.company_name,
      subdomain: tenant.subdomain,
      summary: {
        total_tables: 34,
        orders_count: orders.length,
        shipments_count: shipments.length,
        users_count: users.length,
        wallets_count: wallets.length,
        invoices_count: invoices.length,
      },
      data: {
        tenant,
        users,
        sub_users: subUsers,
        pickup_addresses: pickupAddresses,
        company_documents: companyDocuments,
        kyc_documents: kycDocuments,
        orders,
        order_items: orderItems,
        order_status_histories: orderStatusHistories,
        shipments,
        shipment_status_histories: shipmentStatusHistories,
        tracking_events: trackingEvents,
        shipment_rate_quotes: shipmentRateQuotes,
        ndr_events: ndrEvents,
        rto_records: rtoRecords,
        wallets,
        wallet_transactions: walletTransactions,
        wallet_adjustments: walletAdjustments,
        recharge_orders: rechargeOrders,
        invoices,
        invoice_line_items: invoiceLineItems,
        credit_notes: creditNotes,
        seller_payment_profile: paymentProfile,
        postpaid_invoices: postpaidInvoices,
        postpaid_payments: postpaidPayments,
        postpaid_transactions: postpaidTransactions,
        shopify_connections: shopifyConnections,
        storefront_connections: storefrontConnections,
        storefront_sync_logs: storefrontSyncLogs,
        support_tickets: supportTickets,
        ticket_messages: ticketMessages,
        ticket_attachments: ticketAttachments,
        tenant_settings: tenantSettings,
        settings_histories: settingsHistories,
        api_keys: apiKeys,
        tenant_webhooks: tenantWebhooks,
        tenant_subscriptions: tenantSubscriptions,
        plan_usage: planUsage,
        plan_history: planHistory,
        cod_remittances: codRemittances,
        weight_discrepancy_disputes: weightDisputes,
      },
    };
  }

  /**
   * Create and write compressed backup file to local server disk storage
   */
  async createBackup(tenantId, adminUser = null) {
    const backupDir = ensureBackupDir();
    const dataPayload = await this.extractSellerData(tenantId);

    if (adminUser) {
      dataPayload.exported_by = {
        admin_id: adminUser.id || adminUser.sub,
        email: adminUser.email,
        name: adminUser.name,
      };
    }

    const jsonString = JSON.stringify(dataPayload, null, 2);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf8'));

    // SHA-256 Checksum for tamper verification
    const hash = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
    dataPayload.sha256 = hash;

    const safeSlug = String(dataPayload.company_name || 'seller')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 30);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `seller_backup_${safeSlug}_${tenantId.substring(0, 8)}_${timestamp}.json.gz`;
    const fullPath = path.join(backupDir, filename);

    fs.writeFileSync(fullPath, compressedBuffer);
    const stats = fs.statSync(fullPath);

    logger.info(`[SellerBackup] Created seller backup: ${filename} (${stats.size} bytes, sha256: ${hash})`);

    return {
      filename,
      filepath: fullPath,
      size_bytes: stats.size,
      sha256: hash,
      created_at: new Date(),
      compressed_buffer: compressedBuffer,
      summary: dataPayload.summary,
      company_name: dataPayload.company_name,
    };
  }

  /**
   * Complete Purge: Backs up data to disk, then cascades and hard-deletes all database records
   */
  async purgeSeller(tenantId, adminUser, reason = 'Seller account deleted by platform admin') {
    if (!tenantId) throw new ValidationError('Tenant ID is required');

    // 1. Mandatory Pre-backup to local disk
    const backupResult = await this.createBackup(tenantId, adminUser);
    if (!backupResult || !backupResult.filepath || !fs.existsSync(backupResult.filepath)) {
      throw new Error('Pre-deletion local drive backup failed. Database purge aborted for safety.');
    }

    // 2. Cascade delete in safe database transaction
    await sequelize.transaction(async (t) => {
      // Find IDs for nested children
      const orders = await Order.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const orderIds = orders.map(o => o.id);

      const shipments = await Shipment.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const shipmentIds = shipments.map(s => s.id);

      const wallets = await Wallet.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const walletIds = wallets.map(w => w.id);

      const invoices = await Invoice.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const invoiceIds = invoices.map(i => i.id);

      const tickets = await SupportTicket.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const ticketIds = tickets.map(ti => ti.id);

      // A. Deep child tables
      const destroySafe = async (model, where = { tenant_id: tenantId }) => {
        if (!model) return;
        try {
          await model.destroy({ where, transaction: t });
        } catch (err) {
          logger.warn(`[SellerBackup] Warning purging ${model.name || model.tableName}: ${err.message}`);
        }
      };

      // A. Deep child tables
      if (ticketIds.length > 0) {
        await destroySafe(TicketAttachment, { ticket_id: { [Op.in]: ticketIds } });
        await destroySafe(TicketMessage, { ticket_id: { [Op.in]: ticketIds } });
      }

      if (invoiceIds.length > 0) {
        await destroySafe(InvoiceLineItem, { invoice_id: { [Op.in]: invoiceIds } });
        await destroySafe(CreditNote, { invoice_id: { [Op.in]: invoiceIds } });
      }

      if (walletIds.length > 0) {
        await destroySafe(WalletTransaction, { wallet_id: { [Op.in]: walletIds } });
      }

      if (shipmentIds.length > 0) {
        await destroySafe(TrackingEvent, { shipment_id: { [Op.in]: shipmentIds } });
        await destroySafe(ShipmentStatusHistory, { shipment_id: { [Op.in]: shipmentIds } });
        await destroySafe(NdrAction, { shipment_id: { [Op.in]: shipmentIds } });
        await destroySafe(NdrEvent, { shipment_id: { [Op.in]: shipmentIds } });
        await destroySafe(RtoRecord, { shipment_id: { [Op.in]: shipmentIds } });
      }

      if (orderIds.length > 0) {
        await destroySafe(OrderItem, { order_id: { [Op.in]: orderIds } });
        await destroySafe(OrderStatusHistory, { order_id: { [Op.in]: orderIds } });
        await destroySafe(ShipmentRateQuote, { order_id: { [Op.in]: orderIds } });
      }

      // B. Second level child tables
      await destroySafe(Shipment);
      await destroySafe(Order);
      await destroySafe(OrderImport);
      await destroySafe(Manifest);
      await destroySafe(SupportTicket);
      await destroySafe(Invoice);
      await destroySafe(PostpaidInvoice);
      await destroySafe(PostpaidPayment);
      await destroySafe(PostpaidTransaction);
      await destroySafe(SellerPaymentTermsHistory);
      await destroySafe(SellerPaymentProfile);
      await destroySafe(WalletAdjustment);
      await destroySafe(RechargeOrder);
      await destroySafe(WalletRechargeTransaction);
      await destroySafe(Wallet);
      await destroySafe(CodRemittance);
      await destroySafe(WeightDiscrepancyDispute);
      await destroySafe(ShopifyConnection);
      await destroySafe(StorefrontSyncLog);
      await destroySafe(StorefrontConnection);
      await destroySafe(ApiKeyUsageLog);
      await destroySafe(ApiKey);
      await destroySafe(WebhookDelivery);
      await destroySafe(TenantWebhook);
      await destroySafe(PlanUsageTracking);
      await destroySafe(PlanChangeHistory);
      await destroySafe(TenantSubscription);
      await destroySafe(TenantSetting);
      await destroySafe(SettingsChangeHistory);
      await destroySafe(PickupAddress);
      await destroySafe(CompanyDocument);
      await destroySafe(KycDocument);
      await destroySafe(SubUser);

      // C. User tokens and users
      const users = await User.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const userIds = users.map(u => u.id);
      if (userIds.length > 0) {
        const { RefreshToken, PasswordResetToken, AuditLog } = require('../models');
        await destroySafe(RefreshToken, { user_id: { [Op.in]: userIds } });
        await destroySafe(PasswordResetToken, { user_id: { [Op.in]: userIds } });
        await destroySafe(AuditLog, { user_id: { [Op.in]: userIds } });
      }
      await destroySafe(User);

      // D. Finally delete the tenant
      await Tenant.destroy({ where: { id: tenantId }, transaction: t });
    });

    // 3. Platform Audit Log
    if (PlatformAuditLog) {
      await PlatformAuditLog.create({
        admin_id: adminUser?.id || null,
        admin_email: adminUser?.email || 'admin@nanoshipy.com',
        action: 'DELETE_SELLER_ACCOUNT',
        target_type: 'tenant',
        target_id: tenantId,
        details: {
          mode: 'purge',
          company_name: backupResult.company_name,
          backup_filename: backupResult.filename,
          backup_sha256: backupResult.sha256,
          backup_size: backupResult.size_bytes,
          reason,
        },
      }).catch(() => {});
    }

    logger.info(`[SellerBackup] Successfully purged tenant ${tenantId}. Backup stored: ${backupResult.filename}`);

    return {
      success: true,
      mode: 'purge',
      message: `Seller account "${backupResult.company_name}" permanently deleted. Backup archive saved to local drive.`,
      backup: {
        filename: backupResult.filename,
        size_bytes: backupResult.size_bytes,
        sha256: backupResult.sha256,
      },
      buffer: backupResult.compressed_buffer,
    };
  }

  /**
   * Soft-Delete / Archive: Backs up data to disk, suspends tenant, releases subdomain, revokes credentials
   */
  async archiveSeller(tenantId, adminUser, reason = 'Seller account archived by platform admin') {
    if (!tenantId) throw new ValidationError('Tenant ID is required');

    const backupResult = await this.createBackup(tenantId, adminUser);
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const timestamp = Date.now();
    const originalSubdomain = tenant.subdomain;
    const archivedSubdomain = `${originalSubdomain}_del_${timestamp}`.substring(0, 63);

    await sequelize.transaction(async (t) => {
      // 1. Update tenant status and free original subdomain
      await tenant.update({
        status: 'suspended',
        subdomain: archivedSubdomain,
      }, { transaction: t });

      // 2. Deactivate all users of tenant and scramble tokens
      try {
        await User.update({
          is_active: false,
        }, {
          where: { tenant_id: tenantId },
          transaction: t,
        });
      } catch (err) {
        logger.warn(`[SellerBackup] Warning deactivating users during archive: ${err.message}`);
      }

      // 3. Revoke active refresh tokens
      const users = await User.findAll({ where: { tenant_id: tenantId }, attributes: ['id'], transaction: t });
      const userIds = users.map(u => u.id);
      if (userIds.length > 0) {
        const { RefreshToken } = require('../models');
        if (RefreshToken) {
          try {
            await RefreshToken.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });
          } catch (err) {}
        }
      }

      // 4. Revoke API Keys
      if (ApiKey) {
        try {
          await ApiKey.update({ is_active: false }, { where: { tenant_id: tenantId }, transaction: t });
        } catch (err) {}
      }
    });

    if (PlatformAuditLog) {
      await PlatformAuditLog.create({
        admin_id: adminUser?.id || null,
        admin_email: adminUser?.email || 'admin@nanoshipy.com',
        action: 'ARCHIVE_SELLER_ACCOUNT',
        target_type: 'tenant',
        target_id: tenantId,
        details: {
          mode: 'archive',
          company_name: tenant.company_name,
          original_subdomain: originalSubdomain,
          archived_subdomain: archivedSubdomain,
          backup_filename: backupResult.filename,
          backup_sha256: backupResult.sha256,
          reason,
        },
      }).catch(() => {});
    }

    logger.info(`[SellerBackup] Successfully archived tenant ${tenantId}. Backup stored: ${backupResult.filename}`);

    return {
      success: true,
      mode: 'archive',
      message: `Seller account "${tenant.company_name}" safely archived. Backup archive saved to local drive.`,
      backup: {
        filename: backupResult.filename,
        size_bytes: backupResult.size_bytes,
        sha256: backupResult.sha256,
      },
      buffer: backupResult.compressed_buffer,
    };
  }

  /**
   * Read existing backup file from local storage for download
   */
  getBackupFile(filename) {
    const backupDir = ensureBackupDir();
    // Prevent path traversal
    const safeName = path.basename(filename);
    const fullPath = path.join(backupDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError('Backup file not found on local drive');
    }
    return {
      filename: safeName,
      filepath: fullPath,
      buffer: fs.readFileSync(fullPath),
    };
  }
}

module.exports = new SellerBackupService();
module.exports.SellerBackupService = SellerBackupService;
