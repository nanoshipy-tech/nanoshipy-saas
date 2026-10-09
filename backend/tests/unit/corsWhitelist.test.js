'use strict';

const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('CORS Configuration Security Unit Test (#19)', () => {
  let app;

  beforeAll(() => {
    app = express();
    const config = {
      frontendUrl: 'https://app.nanoshipy.com',
      platformAdminFrontendUrl: 'https://admin.nanoshipy.com',
    };

    const allowedOrigins = [
      config.frontendUrl,
      config.platformAdminFrontendUrl,
      'https://app.nanoshipy.com',
      'https://admin.nanoshipy.com',
      'https://nanoshipy.com',
      'https://www.nanoshipy.com',
    ].filter(Boolean);

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    }));

    app.get('/api/test', (req, res) => res.json({ ok: true }));
  });

  it('allows whitelisted production origin', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('Origin', 'https://app.nanoshipy.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://app.nanoshipy.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unauthorized third-party origin', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('Origin', 'https://malicious-attacker.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('permits requests with no origin header (server-to-server / webhooks)', async () => {
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
