'use strict';

const request = require('supertest');
const app = require('../../src/app');

describe('Support Tickets Routes (Integration)', () => {
  describe('Tenant Support Routes', () => {
    test('should return 401 for unauthenticated list request', async () => {
      const res = await request(app)
        .get('/api/v1/support/tickets');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 401 for unauthenticated create ticket request', async () => {
      const res = await request(app)
        .post('/api/v1/support/tickets')
        .send({
          subject: 'My ticket subject',
          category: 'technical',
          message: 'My issue description details...',
        });
      
      expect(res.statusCode).toBe(401);
    });

    test('should return 401 for unauthenticated reply ticket request', async () => {
      const res = await request(app)
        .post('/api/v1/support/tickets/some-uuid/reply')
        .send({
          message: 'My reply description details...',
        });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Platform Admin Support Routes', () => {
    test('should return 401 for unauthenticated platform queue request', async () => {
      const res = await request(app)
        .get('/api/v1/platform/tickets');
      
      expect(res.statusCode).toBe(401);
    });

    test('should return 401 for unauthenticated platform summary request', async () => {
      const res = await request(app)
        .get('/api/v1/platform/tickets/summary');
      
      expect(res.statusCode).toBe(401);
    });
  });
});
