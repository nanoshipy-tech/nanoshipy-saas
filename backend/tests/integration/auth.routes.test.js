const request = require('supertest');
const app = require('../../src/app');

// Skip integration tests unless DB is explicitly available
// Run with: jest tests/integration
describe('Auth Routes (Integration)', () => {
  it('should return 422 for invalid registration payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
      });
    
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
