'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../src/middlewares/platformAuth.middleware', () => ({
  isPlatformAdmin: (req, res, next) => next(),
  isPlatformAdminTemp: (req, res, next) => next(),
}));

jest.mock('../../src/models', () => ({
  KycDocument: {
    count: jest.fn().mockResolvedValue(5),
  },
  NdrEvent: {
    count: jest.fn().mockResolvedValue(12),
  },
  SupportTicket: {
    count: jest.fn().mockResolvedValue(3),
  },
}));

const { KycDocument, NdrEvent, SupportTicket } = require('../../src/models');
const router = require('../../src/routes/index.routes');

describe('GET /api/v1/platform/nav-counts (Sidebar Notification Badges) - Fix #12', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', router);
  });

  it('should query NdrEvent.count with status open and return accurate ndr_fresh count', async () => {
    const res = await request(app).get('/api/v1/platform/nav-counts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      kyc_pending: 5,
      ndr_fresh: 12,
      tickets_open: 3,
    });

    expect(NdrEvent.count).toHaveBeenCalledWith({ where: { status: 'open' } });
  });
});
