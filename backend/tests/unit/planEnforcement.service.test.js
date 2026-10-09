'use strict';

const planEnforcementService = require('../../src/services/planEnforcement.service');
const { TenantSubscription, SubscriptionPlan, PlanUsageTracking, User } = require('../../src/models');
const { ForbiddenError } = require('../../src/utils/errors');

jest.mock('../../src/models', () => {
  return {
    TenantSubscription: {
      findOne: jest.fn(),
    },
    SubscriptionPlan: {
      findByPk: jest.fn(),
    },
    PlanUsageTracking: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
    User: {
      count: jest.fn(),
    },
  };
});

describe('PlanEnforcementService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should throw ForbiddenError if active subscription status is suspended', async () => {
    TenantSubscription.findOne.mockResolvedValue({
      status: 'suspended',
      plan: { name: 'Growth' },
    });

    await expect(
      planEnforcementService.checkLimit('tenant-uuid', 'max_orders_per_month')
    ).rejects.toThrow(ForbiddenError);
  });

  test('should throw PlanLimitExceededError if monthly orders count hits the limit cap', async () => {
    TenantSubscription.findOne.mockResolvedValue({
      status: 'active',
      current_period_start: '2026-07-01',
      current_period_end: '2026-08-01',
      plan: {
        max_orders_per_month: 500,
      },
    });

    PlanUsageTracking.findOne.mockResolvedValue({
      orders_count: 500,
    });

    await expect(
      planEnforcementService.checkLimit('tenant-uuid', 'max_orders_per_month')
    ).rejects.toThrow(planEnforcementService.PlanLimitExceededError);
  });

  test('should pass checkLimit successfully if count is within limits', async () => {
    TenantSubscription.findOne.mockResolvedValue({
      status: 'active',
      current_period_start: '2026-07-01',
      current_period_end: '2026-08-01',
      plan: {
        max_orders_per_month: 500,
      },
    });

    PlanUsageTracking.findOne.mockResolvedValue({
      orders_count: 240,
    });

    await expect(
      planEnforcementService.checkLimit('tenant-uuid', 'max_orders_per_month')
    ).resolves.not.toThrow();
  });

  test('should enforce users count limit check correctly against active users in database', async () => {
    TenantSubscription.findOne.mockResolvedValue({
      status: 'active',
      current_period_start: '2026-07-01',
      current_period_end: '2026-08-01',
      plan: {
        max_users: 5,
      },
    });

    PlanUsageTracking.findOne.mockResolvedValue({
      users_count: 5,
    });

    User.count.mockResolvedValue(5);

    await expect(
      planEnforcementService.checkLimit('tenant-uuid', 'max_users')
    ).rejects.toThrow(planEnforcementService.PlanLimitExceededError);
  });

});
