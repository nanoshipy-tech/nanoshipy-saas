'use strict';

describe('Public Tracking Awaiting Courier Scan Unit Test (#27)', () => {
  it('returns booked_awaiting_pickup when order exists without completed courier scan', async () => {
    const mockOrder = {
      id: 'order-111',
      order_number: 'ORD-AWAITING-SCAN',
      customer_name: 'Rohit Sharma',
      pickup_city: 'Mumbai',
      pickup_state: 'MH',
      shipping_city: 'Pune',
      shipping_state: 'MH',
      created_at: new Date().toISOString(),
      tenant: { company_name: 'Rohit Store', subdomain: 'rohit' },
      shipments: [],
    };

    jest.doMock('../../src/models', () => ({
      Shipment: {
        findOne: jest.fn().mockResolvedValue(null),
      },
      Order: {
        findOne: jest.fn().mockResolvedValue(mockOrder),
      },
      TrackingEvent: {},
      CourierProvider: {},
      Tenant: {},
    }));

    const trackingService = require('../../src/services/tracking.service');
    const res = await trackingService.getPublicTracking('ORD-AWAITING-SCAN');

    expect(res).not.toBeNull();
    expect(res.current_status).toBe('booked_awaiting_pickup');
    expect(res.awb_number).toBe('Awaiting Courier Scan');
    expect(res.events[0].remark).toContain('Awaiting courier pickup');
  });
});
