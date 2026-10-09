'use strict';

const planRenewalService = require('../../src/services/planRenewal.service');
const { TenantSubscription, SubscriptionPlan, PlanUsageTracking, PlanChangeHistory, Invoice, InvoiceLineItem, Tenant, User } = require('../../src/models');
const walletService = require('../../src/services/wallet.service');
const subscriptionPlanService = require('../../src/services/subscriptionPlan.service');
const emailService = require('../../src/services/email.service');

jest.mock('../../src/models', () => {
  return {
    TenantSubscription: {
      findByPk: jest.fn(),
    },
    SubscriptionPlan: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
    },
    PlanUsageTracking: {
      create: jest.fn(),
    },
    PlanChangeHistory: {
      create: jest.fn(),
    },
    Invoice: {
      create: jest.fn().mockResolvedValue({ id: 'inv-123', update: jest.fn() }),
    },
    InvoiceLineItem: {
      create: jest.fn(),
    },
    Tenant: {
      findByPk: jest.fn().mockResolvedValue({ id: 'tenant-uuid', company_state: 'Tamil Nadu' }),
    },
    User: {
      findOne: jest.fn().mockResolvedValue({ id: 'owner-uuid', email: 'owner@tenant.com', name: 'Owner' }),
    },
    sequelize: {
      transaction: jest.fn(async (cb) => {
        const mockTx = {
          commit: jest.fn(),
          rollback: jest.fn(),
          LOCK: { UPDATE: 'UPDATE' },
        };
        if (typeof cb === 'function') return cb(mockTx);
        return mockTx;
      }),
    },
  };
});

jest.mock('../../src/services/wallet.service', () => ({
  debit: jest.fn(),
}));

jest.mock('../../src/services/subscriptionPlan.service', () => ({
  syncCourierAccess: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/taxCalculation.service', () => ({
  calculateTax: jest.fn().mockReturnValue({ cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 999 }),
}));

jest.mock('../../src/services/invoiceNumbering.service', () => ({
  generateNextNumber: jest.fn().mockResolvedValue('INV/2026-27/000001'),
}));

jest.mock('../../src/services/invoicePdf.service', () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue('http://mock.pdf'),
}));

describe('PlanRenewalService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should successfully renew active subscription if wallet has sufficient balance', async () => {
    const mockPlan = {
      id: 'plan-growth-id',
      name: 'Growth',
      price_monthly: 999.00,
      price_yearly: null,
      courier_access_tier: 'standard',
    };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'plan-growth-id',
      plan: mockPlan,
      pendingPlan: null,
      auto_renew: true,
      billing_cycle: 'monthly',
      update: jest.fn().mockResolvedValue(true),
    };

    TenantSubscription.findByPk.mockResolvedValue(mockSub);
    walletService.debit.mockResolvedValue(true); // Success debit

    await planRenewalService.renewSubscription('sub-uuid', null);

    expect(walletService.debit).toHaveBeenCalledWith(
      'tenant-uuid',
      999.00,
      'subscription_debit',
      'plan-growth-id',
      expect.any(String),
      null,
      expect.any(Object)
    );

    expect(mockSub.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        plan_id: 'plan-growth-id',
      }),
      expect.any(Object)
    );

    expect(PlanUsageTracking.create).toHaveBeenCalled();
    expect(Invoice.create).toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'subscription-renewed',
      })
    );
  });

  test('should transition to grace_period on first renewal failure due to insufficient balance', async () => {
    const mockPlan = {
      id: 'plan-growth-id',
      name: 'Growth',
      price_monthly: 999.00,
      price_yearly: null,
      courier_access_tier: 'standard',
    };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'plan-growth-id',
      plan: mockPlan,
      pendingPlan: null,
      auto_renew: true,
      billing_cycle: 'monthly',
      status: 'active',
      update: jest.fn().mockResolvedValue(true),
    };

    TenantSubscription.findByPk.mockResolvedValue(mockSub);
    walletService.debit.mockRejectedValue(new Error('Insufficient balance')); // Failed debit

    await planRenewalService.renewSubscription('sub-uuid', null);

    expect(mockSub.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'grace_period',
        grace_period_ends_at: expect.any(Date),
      }),
      expect.any(Object)
    );

    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'subscription-renewal-failed',
      })
    );
  });

  test('should transition to suspended and revoke courier access if grace period has expired', async () => {
    const mockPlan = {
      id: 'plan-growth-id',
      name: 'Growth',
      price_monthly: 999.00,
      price_yearly: null,
      courier_access_tier: 'standard',
    };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'plan-growth-id',
      plan: mockPlan,
      pendingPlan: null,
      auto_renew: true,
      billing_cycle: 'monthly',
      status: 'grace_period',
      // Grace period expired yesterday
      grace_period_ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      update: jest.fn().mockResolvedValue(true),
    };

    TenantSubscription.findByPk.mockResolvedValue(mockSub);
    walletService.debit.mockRejectedValue(new Error('Insufficient balance'));
    SubscriptionPlan.findOne.mockResolvedValue({ id: 'free-plan-id', courier_access_tier: 'basic' });

    await planRenewalService.renewSubscription('sub-uuid', null);

    expect(mockSub.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'suspended',
      }),
      expect.any(Object)
    );

    // Revokes courier access immediately to basic level
    expect(subscriptionPlanService.syncCourierAccess).toHaveBeenCalledWith(
      'tenant-uuid',
      'basic',
      expect.any(Object)
    );
  });

});
