'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// Mock models
jest.mock('../../src/models', () => {
  const mockTenant = {
    findByPk: jest.fn(),
    destroy: jest.fn(),
  };
  const mockOrder = {
    count: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn(),
  };
  const mockShipment = {
    count: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn(),
  };
  const mockUser = {
    count: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };
  const mockWallet = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn(),
  };
  const mockInvoice = {
    findAll: jest.fn(),
    destroy: jest.fn(),
  };
  const mockSupportTicket = {
    findAll: jest.fn(),
    destroy: jest.fn(),
  };
  const mockSellerPaymentProfile = {
    findOne: jest.fn(),
    destroy: jest.fn(),
  };
  const mockPlatformAuditLog = {
    create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const mockSequelize = {
    transaction: jest.fn(async (cb) => {
      const mockT = { commit: jest.fn(), rollback: jest.fn() };
      return cb(mockT);
    }),
  };

  return {
    sequelize: mockSequelize,
    Tenant: mockTenant,
    Order: mockOrder,
    OrderItem: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    OrderStatusHistory: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    OrderImport: { destroy: jest.fn() },
    Shipment: mockShipment,
    ShipmentStatusHistory: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    TrackingEvent: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    ShipmentRateQuote: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    Manifest: { destroy: jest.fn() },
    NdrEvent: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    NdrAction: { destroy: jest.fn() },
    RtoRecord: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    Wallet: mockWallet,
    WalletTransaction: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    WalletAdjustment: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    RechargeOrder: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    WalletRechargeTransaction: { destroy: jest.fn() },
    Invoice: mockInvoice,
    InvoiceLineItem: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    CreditNote: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PostpaidInvoice: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PostpaidPayment: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PostpaidTransaction: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    SellerPaymentProfile: mockSellerPaymentProfile,
    SellerPaymentTermsHistory: { destroy: jest.fn() },
    ShopifyConnection: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    StorefrontConnection: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    StorefrontSyncLog: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    SupportTicket: mockSupportTicket,
    TicketMessage: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    TicketAttachment: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    TenantSetting: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    SettingsChangeHistory: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    ApiKey: { destroy: jest.fn(), update: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    ApiKeyUsageLog: { destroy: jest.fn() },
    TenantWebhook: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    WebhookDelivery: { destroy: jest.fn() },
    TenantSubscription: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PlanUsageTracking: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PlanChangeHistory: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    PlatformAuditLog: mockPlatformAuditLog,
    CodRemittance: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    WeightDiscrepancyDispute: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    SubUser: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    User: mockUser,
    Role: { findAll: jest.fn().mockResolvedValue([]) },
    PickupAddress: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    CompanyDocument: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    KycDocument: { destroy: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
    RefreshToken: { destroy: jest.fn() },
    PasswordResetToken: { destroy: jest.fn() },
    AuditLog: { destroy: jest.fn() },
  };
});

const sellerBackupService = require('../../src/services/sellerBackup.service');
const models = require('../../src/models');

describe('SellerBackupService Unit Tests', () => {
  const tenantId = '00000000-0000-0000-0000-111111111111';
  const mockTenantData = {
    id: tenantId,
    company_name: 'Apex Logistics Inc',
    subdomain: 'apexlogistics',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    update: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreDeleteStats', () => {
    test('returns correct count and wallet balance metrics', async () => {
      models.Tenant.findByPk.mockResolvedValue(mockTenantData);
      models.Order.count.mockResolvedValue(42);
      models.Shipment.count
        .mockResolvedValueOnce(38) // total shipments
        .mockResolvedValueOnce(3); // active shipments
      models.User.count.mockResolvedValue(2);
      models.Wallet.findOne.mockResolvedValue({ balance: '1500.50' });
      models.SellerPaymentProfile.findOne.mockResolvedValue({
        billing_type: 'prepaid',
        outstanding_balance: 0,
      });

      const stats = await sellerBackupService.getPreDeleteStats(tenantId);

      expect(stats.company_name).toBe('Apex Logistics Inc');
      expect(stats.stats.orders_count).toBe(42);
      expect(stats.stats.shipments_count).toBe(38);
      expect(stats.stats.active_shipments).toBe(3);
      expect(stats.has_active_shipments).toBe(true);
      expect(stats.stats.wallet_balance).toBe(1500.50);
    });

    test('throws NotFoundError if tenant does not exist', async () => {
      models.Tenant.findByPk.mockResolvedValue(null);
      await expect(sellerBackupService.getPreDeleteStats('invalid-id')).rejects.toThrow('Seller account not found');
    });
  });

  describe('createBackup', () => {
    test('creates compressed .json.gz file on local server drive with valid sha256', async () => {
      models.Tenant.findByPk.mockResolvedValue(mockTenantData);
      models.User.findAll = jest.fn().mockResolvedValue([{ id: 'u1', email: 'owner@apex.com', tenant_id: tenantId }]);
      models.Order.findAll = jest.fn().mockResolvedValue([{ id: 'o1', order_number: 'ORD-101', tenant_id: tenantId }]);
      models.Shipment.findAll = jest.fn().mockResolvedValue([]);
      models.Wallet.findAll = jest.fn().mockResolvedValue([{ id: 'w1', balance: 500, tenant_id: tenantId }]);
      models.Invoice.findAll = jest.fn().mockResolvedValue([]);
      models.SupportTicket.findAll = jest.fn().mockResolvedValue([]);

      const adminUser = { id: 'admin-1', email: 'admin@nanoshipy.com', name: 'Super Admin' };
      const backup = await sellerBackupService.createBackup(tenantId, adminUser);

      expect(backup.filename).toMatch(/seller_backup_apex_logistics_inc_/);
      expect(backup.filename.endsWith('.json.gz')).toBe(true);
      expect(fs.existsSync(backup.filepath)).toBe(true);
      expect(backup.size_bytes).toBeGreaterThan(0);
      expect(backup.sha256).toHaveLength(64); // sha256 hex string

      // Verify uncompressed content
      const fileBytes = fs.readFileSync(backup.filepath);
      const unzipped = zlib.gunzipSync(fileBytes).toString('utf8');
      const parsed = JSON.parse(unzipped);

      expect(parsed.tenant_id).toBe(tenantId);
      expect(parsed.company_name).toBe('Apex Logistics Inc');
      expect(parsed.exported_by.email).toBe('admin@nanoshipy.com');
      expect(parsed.data.users).toHaveLength(1);
      expect(parsed.data.orders).toHaveLength(1);

      // Clean up test file
      if (fs.existsSync(backup.filepath)) {
        fs.unlinkSync(backup.filepath);
      }
    });
  });

  describe('purgeSeller', () => {
    test('executes cascade purge in transaction after taking local backup', async () => {
      models.Tenant.findByPk.mockResolvedValue(mockTenantData);
      models.Order.findAll = jest.fn().mockResolvedValue([{ id: 'o1' }]);
      models.Shipment.findAll = jest.fn().mockResolvedValue([{ id: 's1' }]);
      models.Wallet.findAll = jest.fn().mockResolvedValue([{ id: 'w1' }]);
      models.Invoice.findAll = jest.fn().mockResolvedValue([]);
      models.SupportTicket.findAll = jest.fn().mockResolvedValue([]);
      models.User.findAll = jest.fn().mockResolvedValue([{ id: 'u1' }]);

      const adminUser = { id: 'admin-1', email: 'admin@nanoshipy.com', name: 'Super Admin' };
      const result = await sellerBackupService.purgeSeller(tenantId, adminUser, 'Merchant request');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('purge');
      expect(result.backup.filename).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);

      // Verify transaction committed and destroyed tenant
      expect(models.sequelize.transaction).toHaveBeenCalled();
      expect(models.Tenant.destroy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: tenantId } })
      );

      // Clean up backup file created during test
      const fullPath = path.join(__dirname, '..', '..', 'storage', 'backups', 'sellers', result.backup.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  });

  describe('archiveSeller', () => {
    test('archives tenant, deactivates users, and scrambles subdomain', async () => {
      const mockTenantInstance = {
        ...mockTenantData,
        update: jest.fn().mockResolvedValue(true),
      };
      models.Tenant.findByPk.mockResolvedValue(mockTenantInstance);
      models.User.findAll = jest.fn().mockResolvedValue([{ id: 'u1' }]);
      models.Order.findAll = jest.fn().mockResolvedValue([]);
      models.Shipment.findAll = jest.fn().mockResolvedValue([]);
      models.Wallet.findAll = jest.fn().mockResolvedValue([]);
      models.Invoice.findAll = jest.fn().mockResolvedValue([]);
      models.SupportTicket.findAll = jest.fn().mockResolvedValue([]);

      const adminUser = { id: 'admin-1', email: 'admin@nanoshipy.com', name: 'Super Admin' };
      const result = await sellerBackupService.archiveSeller(tenantId, adminUser, 'Inactive merchant');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('archive');
      expect(mockTenantInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'suspended',
          subdomain: expect.stringContaining('apexlogistics_del_'),
        }),
        expect.anything()
      );
      expect(models.User.update).toHaveBeenCalledWith(
        { is_active: false },
        expect.objectContaining({ where: { tenant_id: tenantId } })
      );

      // Clean up backup file
      const fullPath = path.join(__dirname, '..', '..', 'storage', 'backups', 'sellers', result.backup.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  });

  describe('getBackupFile security', () => {
    test('prevents path traversal', () => {
      expect(() => {
        sellerBackupService.getBackupFile('../../etc/passwd');
      }).toThrow('Backup file not found on local drive');
    });
  });
});
