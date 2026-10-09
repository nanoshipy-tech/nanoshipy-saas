'use strict';

const platformAnalyticsController = require('../../src/controllers/platformAnalytics.controller');
const { WebsiteVisitorEvent } = require('../../src/models');

describe('Website Visitor Telemetry & Traffic Analytics Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should ingest website visitor telemetry events successfully', async () => {
    const req = {
      body: {
        event_type: 'page_view',
        path: '/pricing',
        referrer: 'https://google.com',
        session_id: 'sess_12345',
        visitor_id: 'vis_abcde',
        screen_resolution: '1920x1080',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'spring_sale',
        metadata: { title: 'Pricing | Nanoshipy' },
      },
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      ip: '192.168.1.1',
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const createSpy = jest.spyOn(WebsiteVisitorEvent, 'create').mockResolvedValue({ id: 'event-uuid-1' });

    await platformAnalyticsController.ingestTelemetry(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, received: true });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      path: '/pricing',
      session_id: 'sess_12345',
      visitor_id: 'vis_abcde',
      utm_source: 'google',
    }));
  });

  it('should aggregate website traffic metrics with unique sessions and top pages', async () => {
    const mockEvents = [
      { event_type: 'page_view', path: '/', visitor_id: 'v1', session_id: 's1', ip_address: '1.1.1.1', created_at: new Date() },
      { event_type: 'page_view', path: '/', visitor_id: 'v1', session_id: 's1', ip_address: '1.1.1.1', created_at: new Date() },
      { event_type: 'page_view', path: '/pricing', visitor_id: 'v2', session_id: 's2', ip_address: '2.2.2.2', created_at: new Date() },
      { event_type: 'track_search', path: '/track', visitor_id: 'v3', session_id: 's3', ip_address: '3.3.3.3', created_at: new Date() },
    ];

    jest.spyOn(WebsiteVisitorEvent, 'findAll').mockResolvedValue(mockEvents);

    const req = { query: { days: 7 } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await platformAnalyticsController.getWebsiteTraffic(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0].data;
    expect(responseData.totalViews).toBe(3); // 3 page views
    expect(responseData.uniqueVisitors).toBe(3); // v1, v2, v3
    expect(responseData.uniqueSessions).toBe(3); // s1, s2, s3
    expect(responseData.trackingLookups).toBe(1); // 1 track_search
    expect(responseData.topPages[0]).toEqual({ path: '/', count: 2 });
    expect(responseData.topPages[1]).toEqual({ path: '/pricing', count: 1 });
  });
});
