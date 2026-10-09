'use strict';

const trackingService = require('../../src/services/tracking.service');
const notificationDispatcher = require('../../src/services/notificationDispatcher.service');
const { Shipment, Order, CourierProvider } = require('../../src/models');

describe('White-Labeled Tracking & Notification Verification', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getPublicTracking resolves real carrier name (Blue Dart Express) instead of Shipway Multi-Carrier', async () => {
    const mockOrder = {
      order_reference: 'WB-99001',
      customer_name: 'Rajesh Kumar',
      shipping_city: 'Bangalore',
      shipping_state: 'Karnataka',
      sender_city: 'Chennai',
      sender_state: 'Tamil Nadu',
      pickupAddress: { city: 'Chennai', state: 'Tamil Nadu' },
    };

    const mockShipment = {
      id: 'ship-111',
      awb_number: '90668242055',
      service_type: '7377',
      status: 'in_transit',
      is_delayed_flag: false,
      estimated_delivery_date: '2026-09-22',
      courier_partner: 'Shipway Partner',
      order: mockOrder,
      tenant: { company_name: 'Test Retail', subdomain: 'retail' },
      provider: {
        provider_key: 'shipway',
        display_name: 'Shipway Multi-Carrier',
        logo_url: '/couriers/shipway.svg',
      },
      trackingEvents: [
        {
          id: 'ev-1',
          status: 'in_transit',
          raw_status: 'In Transit',
          location: 'Bangalore Hub',
          remark: 'Connected to linehaul',
          event_timestamp: new Date().toISOString(),
          source: 'poll',
        },
      ],
    };

    jest.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipment);

    const res = await trackingService.getPublicTracking('90668242055');

    expect(res).toBeDefined();
    expect(res.awb_number).toBe('90668242055');
    // Ensure "Shipway" is never present in carrier name or provider display name
    expect(res.carrier).not.toContain('Shipway');
    expect(res.carrier).toBe('Blue Dart • Express');
    expect(res.provider.display_name).toBe('Blue Dart • Express');
    // Ensure logo is Blue Dart, never Shipway
    expect(res.provider.logo_url).toBe('/couriers/bluedart.svg');
    expect(res.provider.logo_url).not.toContain('shipway');
    // Origin and destination properly mapped
    expect(res.origin).toBe('Chennai, Tamil Nadu');
    expect(res.destination).toBe('Bangalore, Karnataka');
  });

  test('sendShipmentDispatchedNotification formats clean courier name and direct tracking URL', async () => {
    const dispatchSpy = jest.spyOn(notificationDispatcher, 'dispatch').mockResolvedValue({ success: true, channel: 'sms' });

    const mockOrder = {
      order_reference: 'WB-99002',
      customer_name: 'Anita Verma',
      customer_phone: '9876543210',
      customer_email: 'anita@example.com',
      is_walkin: false,
    };

    const mockShipment = {
      id: 'ship-222',
      tenant_id: 'tenant-1',
      awb_number: '11633338078761',
      service_type: '7442',
      order: mockOrder,
      provider: {
        provider_key: 'shipway',
        display_name: 'Shipway Multi-Carrier',
      },
    };

    const res = await notificationDispatcher.sendShipmentDispatchedNotification(mockShipment);

    expect(res.success).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const callArgs = dispatchSpy.mock.calls[0][0];

    expect(callArgs.data.courierName).toBe('Delhivery • Express');
    expect(callArgs.data.courierName).not.toContain('Shipway');
    expect(callArgs.data.trackingUrl).toMatch(/\/track\/11633338078761$/);
    expect(callArgs.data.smsText).toContain('Delhivery • Express');
    expect(callArgs.data.smsText).toMatch(/\/track\/11633338078761/);
  });

  test('sendShipmentDispatchedNotification dispatches to walk-in sender customer', async () => {
    const dispatchSpy = jest.spyOn(notificationDispatcher, 'dispatch').mockResolvedValue({ success: true, channel: 'whatsapp' });

    const mockOrder = {
      order_reference: 'ORD-WALKIN-1',
      customer_name: 'Deepak Receiver',
      customer_phone: '9876543211',
      sender_name: 'Walk-in Ramesh',
      sender_phone: '9876543210',
      is_walkin: true,
    };

    const mockShipment = {
      id: 'ship-333',
      tenant_id: 'tenant-1',
      awb_number: '90668242055',
      service_type: '7377',
      order: mockOrder,
      provider: {
        provider_key: 'shipway',
        display_name: 'Shipway Multi-Carrier',
      },
    };

    await notificationDispatcher.sendShipmentDispatchedNotification(mockShipment);

    // Both sender and receiver notified
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
    const senderCall = dispatchSpy.mock.calls[0][0];
    const receiverCall = dispatchSpy.mock.calls[1][0];

    expect(senderCall.recipientPhone).toBe('9876543210');
    expect(senderCall.data.customerName).toBe('Walk-in Ramesh');
    expect(senderCall.data.courierName).toBe('Blue Dart • Express');

    expect(receiverCall.recipientPhone).toBe('9876543211');
    expect(receiverCall.data.customerName).toBe('Deepak Receiver');
  });
});
