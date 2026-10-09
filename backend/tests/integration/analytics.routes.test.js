'use strict';

const request = require('supertest');
const app = require('../../src/app');

describe('Analytics & Reports Routes (Integration)', () => {
  describe('Tenant Analytics Routes', () => {
    test('should return 401 for unauthenticated overview request', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .query({ date_from: '2026-01-01', date_to: '2026-01-10' });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 401 for unauthenticated orders-trend request', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/orders-trend')
        .query({ date_from: '2026-01-01', date_to: '2026-01-10' });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Platform Admin Analytics Routes', () => {
    test('should return 401 for unauthenticated platform revenue request', async () => {
      const res = await request(app)
        .get('/api/v1/platform/analytics/revenue')
        .query({ period: 'monthly' });
      
      expect(res.statusCode).toBe(401);
    });

    test('should return 401 for unauthenticated platform system health request', async () => {
      const res = await request(app)
        .get('/api/v1/platform/analytics/system-health');
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Report Export Routes', () => {
    test('should return 401 for unauthenticated export trigger request', async () => {
      const res = await request(app)
        .post('/api/v1/reports/export')
        .send({
          report_type: 'orders_summary',
          format: 'csv',
          date_from: '2026-01-01',
          date_to: '2026-01-10',
        });
      
      expect(res.statusCode).toBe(401);
    });

    test('should return 400 for download request with missing parameters', async () => {
      const res = await request(app)
        .get('/api/v1/reports/download')
        .query({ path: '/uploads/reports/test.csv' }); // missing signature, expires, etc.
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Missing signed URL parameters');
    });
  });
});
