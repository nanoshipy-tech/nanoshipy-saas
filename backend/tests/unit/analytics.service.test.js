'use strict';

// 1. Setup repository mock
jest.mock('../../src/repositories/analyticsQuery.repository', () => {
  return {
    SENTINEL_PLATFORM_UUID: '00000000-0000-0000-0000-000000000000',
    getMetrics: jest.fn(),
    getCourierPerformance: jest.fn(),
    getZoneDistribution: jest.fn(),
    getWalletSpendTrend: jest.fn(),
    getTopTenants: jest.fn(),
  };
});

// Mock models used in payment split
jest.mock('../../src/models', () => {
  return {
    Order: {
      findAll: jest.fn(),
    },
    Tenant: {
      findAll: jest.fn(),
    },
    TenantSubscription: {
      findAll: jest.fn(),
    },
    SubscriptionPlan: {
      findAll: jest.fn(),
    },
    CourierProvider: {
      findAll: jest.fn(),
    },
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

// Import services and mocks
const tenantAnalyticsService = require('../../src/services/tenantAnalytics.service');
const platformAnalyticsService = require('../../src/services/platformAnalytics.service');
const analyticsQueryRepository = require('../../src/repositories/analyticsQuery.repository');
const { Order, Tenant, TenantSubscription } = require('../../src/models');

describe('Tenant Analytics Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return aggregated overview statistics', async () => {
    const mockMetrics = [
      {
        date: '2026-01-01',
        orders_count: 5,
        shipments_count: 4,
        delivered_count: 3,
        ndr_count: 1,
        rto_count: 1,
        cod_amount: 1500,
        prepaid_amount: 1200,
        shipping_spend: 350.50,
      },
      {
        date: '2026-01-02',
        orders_count: 10,
        shipments_count: 8,
        delivered_count: 6,
        ndr_count: 2,
        rto_count: 1,
        cod_amount: 3000,
        prepaid_amount: 2400,
        shipping_spend: 700.20,
      }
    ];

    analyticsQueryRepository.getMetrics.mockResolvedValue(mockMetrics);

    const result = await tenantAnalyticsService.getOverview('tenant-123', '2026-01-01', '2026-01-02');

    expect(result).toBeDefined();
    expect(result.orders_count).toBe(15);
    expect(result.shipments_count).toBe(12);
    expect(result.delivered_count).toBe(9);
    expect(result.ndr_count).toBe(3);
    expect(result.rto_count).toBe(2);
    expect(result.delivery_success_rate).toBe(81.82); // 9 / (9 + 2) = 9/11 = 81.818%
    expect(result.cod_amount).toBe(4500);
    expect(result.prepaid_amount).toBe(3600);
    expect(result.shipping_spend).toBe(1050.70);
  });
});

describe('Platform Analytics Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should compute platform revenue by subscription plans', async () => {
    const mockSubs = [
      {
        id: 'sub-1',
        billing_cycle: 'monthly',
        plan: { name: 'Growth', price_monthly: 999.00 },
      },
      {
        id: 'sub-2',
        billing_cycle: 'yearly',
        plan: { name: 'Growth', price_yearly: 9990.00 }, // ARR / 12 = 832.50
      },
      {
        id: 'sub-3',
        billing_cycle: 'monthly',
        plan: { name: 'Enterprise', price_monthly: 4999.00 },
      }
    ];

    TenantSubscription.findAll.mockResolvedValue(mockSubs);

    const result = await platformAnalyticsService.getRevenueByPlan();

    expect(result).toBeDefined();
    expect(result).toHaveLength(2); // Growth and Enterprise

    const growth = result.find(r => r.plan_name === 'Growth');
    expect(growth).toBeDefined();
    expect(growth.active_count).toBe(2);
    expect(growth.mrr).toBe(1831.50); // 999 + 832.50
  });
});
