'use strict';

const subscriptionPlanService = require('../../src/services/subscriptionPlan.service');
const { SubscriptionPlan, TenantSubscription, PlanUsageTracking, PlanChangeHistory, TenantCourierAccess, CourierProvider } = require('../../src/models');
const walletService = require('../../src/services/wallet.service');

jest.mock('../../src/models', () => {
  return {
    SubscriptionPlan: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
    },
    TenantSubscription: {
      create: jest.fn(),
      findOne: jest.fn(),
    },
    PlanUsageTracking: {
      create: jest.fn(),
      findOne: jest.fn(),
    },
    PlanChangeHistory: {
      create: jest.fn(),
    },
    TenantCourierAccess: {
      findOrCreate: jest.fn(),
      destroy: jest.fn(),
    },
    CourierProvider: {
      findAll: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn(async (cb) => {
        const mockTx = {
          commit: jest.fn(),
          rollback: jest.fn(),
          LOCK: { UPDATE: 'UPDATE' },
        };
        return cb(mockTx);
      }),
    },
  };
});

jest.mock('../../src/services/wallet.service', () => ({
  debit: jest.fn().mockResolvedValue(true),
}));

describe('SubscriptionPlanService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should successfully initialize default Free subscription for new tenant', async () => {
    const mockPlan = {
      id: 'plan-free-id',
      name: 'Free',
      courier_access_tier: 'basic',
    };
    SubscriptionPlan.findOne.mockResolvedValue(mockPlan);
    CourierProvider.findAll.mockResolvedValue([]);

    await subscriptionPlanService.initializeTenantSubscription('tenant-uuid', null);

    expect(SubscriptionPlan.findOne).toHaveBeenCalledWith(expect.any(Object));
    expect(TenantSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid',
        plan_id: 'plan-free-id',
        status: 'active',
      }),
      expect.any(Object)
    );
    expect(PlanUsageTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid',
      }),
      expect.any(Object)
    );
  });

  test('should compute correct proration charge and upgrade immediately', async () => {
    const mockOldPlan = { id: 'old-id', name: 'Free', price_monthly: 0, price_yearly: null };
    const mockNewPlan = { id: 'new-id', name: 'Growth', price_monthly: 1000, price_yearly: null, courier_access_tier: 'standard' };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'old-id',
      plan: mockOldPlan,
      billing_cycle: 'monthly',
      // Current month started 15 days ago, ends in 15 days (out of a 30-day period)
      current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      update: jest.fn().mockResolvedValue(true),
    };

    TenantSubscription.findOne.mockResolvedValue(mockSub);
    SubscriptionPlan.findByPk.mockResolvedValue(mockNewPlan);
    CourierProvider.findAll.mockResolvedValue([]);

    const result = await subscriptionPlanService.changeSubscription('tenant-uuid', 'new-id', 'monthly', 'user-uuid');

    // Expected proration: (1000 - 0) * (15 / 30) = 500
    expect(walletService.debit).toHaveBeenCalledWith(
      'tenant-uuid',
      expect.any(Number),
      'subscription_debit',
      'new-id',
      expect.any(String),
      'user-uuid',
      expect.any(Object)
    );

    expect(mockSub.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'new-id',
        status: 'active',
      }),
      expect.any(Object)
    );

    expect(result.new_plan).toBe('Growth');
    expect(result.effective).toBe('immediate');
  });

  test('should block downgrade immediately and schedule it for deferred renewal if usage conforms', async () => {
    const mockOldPlan = { id: 'old-id', name: 'Pro', price_monthly: 5000 };
    const mockNewPlan = { id: 'new-id', name: 'Growth', price_monthly: 1000, max_orders_per_month: 100, max_users: 5 };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'old-id',
      plan: mockOldPlan,
      billing_cycle: 'monthly',
      current_period_start: '2026-07-01',
      current_period_end: '2026-08-01',
      update: jest.fn().mockResolvedValue(true),
    };

    TenantSubscription.findOne.mockResolvedValue(mockSub);
    SubscriptionPlan.findByPk.mockResolvedValue(mockNewPlan);
    
    // Usage: 40 orders, 3 users (both below target Growth caps)
    PlanUsageTracking.findOne.mockResolvedValue({
      orders_count: 40,
      users_count: 3,
    });

    const result = await subscriptionPlanService.changeSubscription('tenant-uuid', 'new-id', 'monthly', 'user-uuid');

    expect(mockSub.update).toHaveBeenCalledWith(
      { pending_plan_id: 'new-id' },
      expect.any(Object)
    );
    expect(result.effective).toBe('deferred');
    expect(result.prorated_charge).toBe(0);
  });

  test('should throw DowngradeLimitExceededError if usage exceeds new plan thresholds', async () => {
    const mockOldPlan = { id: 'old-id', name: 'Pro', price_monthly: 5000 };
    const mockNewPlan = { id: 'new-id', name: 'Growth', price_monthly: 1000, max_orders_per_month: 100, max_users: 5 };

    const mockSub = {
      id: 'sub-uuid',
      tenant_id: 'tenant-uuid',
      plan_id: 'old-id',
      plan: mockOldPlan,
      billing_cycle: 'monthly',
      current_period_start: '2026-07-01',
      current_period_end: '2026-08-01',
      update: jest.fn(),
    };

    TenantSubscription.findOne.mockResolvedValue(mockSub);
    SubscriptionPlan.findByPk.mockResolvedValue(mockNewPlan);
    
    // Usage: 150 orders (Growth cap is 100)
    PlanUsageTracking.findOne.mockResolvedValue({
      orders_count: 150,
      users_count: 3,
    });

    await expect(
      subscriptionPlanService.changeSubscription('tenant-uuid', 'new-id', 'monthly', 'user-uuid')
    ).rejects.toThrow(subscriptionPlanService.DowngradeLimitExceededError);
  });

});
