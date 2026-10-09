'use strict';

const { sequelize } = require('../../src/models');
const analyticsRepo = require('../../src/repositories/analyticsQuery.repository');

describe('Analytics Query Repository - SQL Guards (Fix #13, #14)', () => {
  let executedQueries = [];

  beforeEach(() => {
    executedQueries = [];
    jest.spyOn(sequelize, 'query').mockImplementation((sql) => {
      executedQueries.push(sql);
      return Promise.resolve([]);
    });
    jest.spyOn(sequelize, 'getDialect').mockReturnValue('postgres');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should include deleted_at IS NULL on orders, shipments, delivered, and status = paid on revenue queries', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    await analyticsRepo.getMetrics(analyticsRepo.SENTINEL_PLATFORM_UUID, todayStr, todayStr);

    expect(executedQueries.length).toBeGreaterThan(0);

    // Verify orders query includes deleted_at IS NULL
    const ordersSql = executedQueries.find((q) => q.includes('FROM orders'));
    expect(ordersSql).toBeDefined();
    expect(ordersSql).toContain('deleted_at IS NULL');

    // Verify shipments query includes deleted_at IS NULL
    const shipmentsSql = executedQueries.find((q) => q.includes('FROM shipments\n    WHERE'));
    expect(shipmentsSql).toBeDefined();
    expect(shipmentsSql).toContain('deleted_at IS NULL');

    // Verify delivered query includes s.deleted_at IS NULL
    const deliveredSql = executedQueries.find((q) => q.includes("new_status = 'delivered'"));
    expect(deliveredSql).toBeDefined();
    expect(deliveredSql).toContain('s.deleted_at IS NULL');

    // Verify platform revenue query filters by status = 'paid' and deleted_at IS NULL (Fix #14)
    const revenueSql = executedQueries.find((q) => q.includes('FROM invoices'));
    expect(revenueSql).toBeDefined();
    expect(revenueSql).toContain("status = 'paid'");
    expect(revenueSql).toContain('deleted_at IS NULL');
  });

  it('should include deleted_at IS NULL on courier performance and zone queries', async () => {
    await analyticsRepo.getCourierPerformance('tenant-1', '2026-09-01', '2026-09-10');
    const courierSql = executedQueries.find((q) => q.includes('FROM shipments s\n    JOIN courier_providers cp'));
    expect(courierSql).toBeDefined();
    expect(courierSql).toContain('s.deleted_at IS NULL');

    await analyticsRepo.getZoneDistribution('tenant-1', '2026-09-01', '2026-09-10');
    const zoneSql = executedQueries.find((q) => q.includes('FROM shipments s\n    JOIN orders o'));
    expect(zoneSql).toBeDefined();
    expect(zoneSql).toContain('s.deleted_at IS NULL');
    expect(zoneSql).toContain('o.deleted_at IS NULL');
  });
});
