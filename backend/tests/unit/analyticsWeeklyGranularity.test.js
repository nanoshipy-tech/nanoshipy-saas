'use strict';

const tenantAnalyticsService = require('../../src/services/tenantAnalytics.service');

describe('Analytics Weekly Granularity UTC Test (#23)', () => {
  it('correctly groups dates into Monday-based weeks across month boundaries without timezone shifts', async () => {
    // 2026-03-01 is a Sunday; its week starts on Monday 2026-02-23.
    // 2026-03-02 is a Monday; its week starts on Monday 2026-03-02.
    // 2026-03-04 is a Wednesday; its week starts on Monday 2026-03-02.
    const mockDaily = [
      { date: '2026-03-01', orders_count: 10, shipments_count: 10, delivered_count: 8, ndr_count: 1, rto_count: 1, cod_amount: 500, prepaid_amount: 500, shipping_spend: 100 },
      { date: '2026-03-02', orders_count: 20, shipments_count: 20, delivered_count: 15, ndr_count: 2, rto_count: 0, cod_amount: 1000, prepaid_amount: 1000, shipping_spend: 200 },
      { date: '2026-03-04', orders_count: 30, shipments_count: 30, delivered_count: 25, ndr_count: 3, rto_count: 2, cod_amount: 1500, prepaid_amount: 1500, shipping_spend: 300 },
    ];

    const analyticsQueryRepository = require('../../src/repositories/analyticsQuery.repository');
    jest.spyOn(analyticsQueryRepository, 'getMetrics').mockResolvedValue(mockDaily);

    const result = await tenantAnalyticsService.getOrdersTrend('tenant-1', '2026-03-01', '2026-03-07', 'weekly');

    expect(result).toHaveLength(2);
    // First group should be week starting 2026-02-23
    expect(result[0].date).toBe('2026-02-23');
    expect(result[0].orders_count).toBe(10);

    // Second group should be week starting 2026-03-02 (20 + 30 = 50)
    expect(result[1].date).toBe('2026-03-02');
    expect(result[1].orders_count).toBe(50);
  });
});
