'use strict';

const trackingService = require('../../src/services/tracking.service');
const { Shipment, Order } = require('../../src/models');
const { publicTrackingLimiter } = require('../../src/middlewares/rateLimiter.middleware');

describe('Public Tracking - Rate Limiter & PII Masking Tests', () => {
  it('should export publicTrackingLimiter middleware', () => {
    expect(typeof publicTrackingLimiter).toBe('function');
  });

  it('should mask customer name and phone numbers in remarks for public tracking lookup', async () => {
    const mockOrder = {
      order_number: 'ORD-9999',
      customer_name: 'Priya Sharma',
      shipping_city: 'Bangalore',
      shipping_state: 'Karnataka',
      pickup_city: 'Delhi',
      pickup_state: 'Delhi',
    };

    const mockShipment = {
      id: 'shipment-xyz',
      awb_number: 'AWB99887766',
      status: 'in_transit',
      is_delayed_flag: false,
      estimated_delivery_date: '2026-09-15',
      courier_partner: 'Delhivery',
      order: mockOrder,
      tenant: { company_name: 'Fashion Hub', subdomain: 'fashion' },
      trackingEvents: [
        {
          id: 'evt-1',
          status: 'in_transit',
          raw_status: 'In Transit',
          location: 'Hub 1',
          remark: 'Driver contact 9876543210 called customer at customer@test.com',
          event_timestamp: new Date().toISOString(),
          source: 'webhook',
        },
      ],
    };

    jest.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipment);

    const result = await trackingService.getPublicTracking('AWB99887766');

    expect(result).toBeDefined();
    expect(result.awb_number).toBe('AWB99887766');
    // Verify Customer Name is masked
    expect(result.recipient_name).toBe('P**** S*****');
    expect(result.recipient_name).not.toContain('Priya');
    expect(result.recipient_name).not.toContain('Sharma');

    // Verify phone number in remark is masked
    expect(result.events[0].remark).not.toContain('9876543210');
    expect(result.events[0].remark).toContain('98******10');

    // Verify email in remark is masked
    expect(result.events[0].remark).not.toContain('customer@test.com');
    expect(result.events[0].remark).toContain('***@***.***');

    // Verify location is city/state only
    expect(result.destination).toBe('Bangalore, Karnataka');
  });
});
