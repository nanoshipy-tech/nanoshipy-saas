'use strict';

const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');
const { mapStatus } = require('../../src/providers/shipway/shipwayResponseMapper');
const shipwayCredentialSchema = require('../../src/providers/shipway/shipwayCredentialSchema');

describe('Shipway Integration Unit Tests', () => {
  const mockCredentials = {
    username: 'harsh@vintageglobal.co',
    license_key: 'XdF25B9h93zvr0l388aB7pjlH6EGB9Kk',
    warehouse_id: 101,
  };

  describe('shipwayCredentialSchema', () => {
    it('should validate valid username and license_key', () => {
      const { error, value } = shipwayCredentialSchema.validate(mockCredentials);
      expect(error).toBeUndefined();
      expect(value.username).toBe('harsh@vintageglobal.co');
      expect(value.license_key).toBe('XdF25B9h93zvr0l388aB7pjlH6EGB9Kk');
    });

    it('should validate email alternative field', () => {
      const { error } = shipwayCredentialSchema.validate({
        email: 'test@domain.com',
        license_key: 'secret-key-123',
      });
      expect(error).toBeUndefined();
    });

    it('should reject missing license_key', () => {
      const { error } = shipwayCredentialSchema.validate({
        username: 'test@domain.com',
      });
      expect(error).toBeDefined();
    });
  });

  describe('shipwayResponseMapper', () => {
    it('should correctly map official Shipway short status codes', () => {
      expect(mapStatus('SCH')).toBe('pickup_scheduled');
      expect(mapStatus('INT')).toBe('in_transit');
      expect(mapStatus('OFD')).toBe('out_for_delivery');
      expect(mapStatus('DEL')).toBe('delivered');
      expect(mapStatus('PKF')).toBe('failed');
      expect(mapStatus('PCAN')).toBe('cancelled');
      expect(mapStatus('NFI')).toBe('failed');
      expect(mapStatus('RTO')).toBe('rto_initiated');
      expect(mapStatus('UNDELIVERED')).toBe('ndr_initiated');
    });

    it('should correctly map full status descriptions including gaps #1-5', () => {
      expect(mapStatus('Shipment Booked')).toBe('created');
      expect(mapStatus('Out for Delivery')).toBe('out_for_delivery');
      expect(mapStatus('Delivered')).toBe('delivered');
      expect(mapStatus('Return In Transit')).toBe('rto_in_transit');
      expect(mapStatus('Pickup Delayed')).toBe('pickup_scheduled');
      expect(mapStatus('Return Out for Delivery')).toBe('rto_in_transit');
      expect(mapStatus('Reverse Pickup Exception')).toBe('failed');
      expect(mapStatus('Pickup Rescheduled')).toBe('pickup_scheduled');
      expect(mapStatus('Return Undelivered')).toBe('ndr_initiated');
    });

    it('should flag unmapped statuses for review and not default to in_transit', () => {
      expect(mapStatus('Completely Unknown Status Code XYZ')).toBe('unmapped_review_needed');
      expect(mapStatus('')).toBe('unmapped_review_needed');
      expect(mapStatus(null)).toBe('unmapped_review_needed');
    });
  });

  describe('ShipwayAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ShipwayAdapter(mockCredentials, { timeout_ms: 2000 });
    });

    it('should generate correct Basic Auth header', () => {
      const headers = adapter._getAuthHeaders();
      const expectedToken = Buffer.from('harsh@vintageglobal.co:XdF25B9h93zvr0l388aB7pjlH6EGB9Kk').toString('base64');
      expect(headers.Authorization).toBe(`Basic ${expectedToken}`);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should throw ConfigurationError if credentials and env are missing', () => {
      const oldEmail = process.env.SHIPWAY_EMAIL;
      const oldKey = process.env.SHIPWAY_LICENSE_KEY;
      delete process.env.SHIPWAY_EMAIL;
      delete process.env.SHIPWAY_LICENSE_KEY;

      const unconfiguredAdapter = new ShipwayAdapter({}, {});
      expect(() => unconfiguredAdapter._getAuthHeaders()).toThrow(/Shipway credentials missing/i);

      if (oldEmail) process.env.SHIPWAY_EMAIL = oldEmail;
      if (oldKey) process.env.SHIPWAY_LICENSE_KEY = oldKey;
    });

    it('should handle serviceability check parsing correctly', async () => {
      const mockApiResponse = {
        success: 1,
        error: '',
        message: [
          {
            carrier_id: '345',
            name: 'Xpressbees',
            carrier_title: 'Xpressbees Main',
            payment_type: 'P',
          },
          {
            carrier_id: '345',
            name: 'Xpressbees',
            carrier_title: 'Xpressbees Main',
            payment_type: 'C',
          }
        ]
      };

      jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockApiResponse });

      const result = await adapter.checkServiceability({
        deliveryPincode: '500081',
        paymentMode: 'prepaid',
      });

      expect(result.success).toBe(true);
      expect(result.data.serviceable).toBe(true);
      expect(result.data.serviceableCarriers.length).toBe(2);
    });

    it('should handle rates calculation correctly', async () => {
      const mockRatesResponse = [
        {
          zone: 'Zone 3',
          courier_id: '345',
          courier: 'Shipway Delhivery Express (0.5kg)',
          shipment_charges: '65.50',
          charge_weight: '0.5',
        }
      ];

      jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockRatesResponse });

      const result = await adapter.getRates({
        pickupPincode: '500081',
        deliveryPincode: '110001',
        weight: 0.5,
        paymentMode: 'prepaid',
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.length).toBe(1);
      expect(result.data.rates[0].courierName).toMatch(/Delhivery Express/i);
      expect(result.data.rates[0].price).toBe(65.5);
    });

    it('should push order with label generation (POST /v2orders)', async () => {
      const mockOrderResponse = {
        success: true,
        message: 'Order has been added successfully.',
        awb_response: {
          success: true,
          message: 'AWB No. assigned Successfully',
          AWB: '1333110020164',
          carrier_id: '345',
          shipping_url: 'https://app.shipway.com/labels/1333110020164.pdf',
        }
      };

      jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockOrderResponse });

      const result = await adapter.createShipment({
        order: {
          id: 'OMS-10001',
          customer_name: 'Priya Sharma',
          customer_phone: '9876543210',
          customer_email: 'priya@example.com',
          delivery_address: 'Flat 12, Green Park',
          delivery_city: 'Hyderabad',
          delivery_state: 'Telangana',
          delivery_pincode: '500081',
          weight: 0.35,
          amount: 699,
          payment_mode: 'prepaid',
        },
        pickupAddress: { warehouse_id: 101 },
        serviceType: '80622',
      });

      expect(result.success).toBe(true);
      expect(result.data.awbNumber).toBe('1333110020164');
      expect(result.data.labelUrl).toBe('https://app.shipway.com/labels/1333110020164.pdf');
    });

    it('should track shipment correctly (GET /tracking)', async () => {
      const mockTrackResponse = [
        {
          awb: '1333110020164',
          tracking_details: {
            shipment_status: 'DEL',
            shipment_details: [
              {
                courier_id: '345',
                courier_name: 'Shipway Delhivery Express',
                order_id: 'OMS-10001',
                current_status: 'Delivered',
                delivered_to: 'Priya Sharma',
                destination: 'Hyderabad',
              }
            ],
            track_url: 'https://yourstore.shipway.com/t/1333110020164',
            tracking_history: [
              {
                status: 'Delivered',
                location: 'Hyderabad',
                timestamp: '2026-03-19 14:30:00',
                remarks: 'Delivered to consignee',
              }
            ]
          }
        }
      ];

      jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockTrackResponse });

      const result = await adapter.trackShipment({ awbNumber: '1333110020164' });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('delivered');
      expect(result.data.deliveredTo).toBe('Priya Sharma');
      expect(result.data.trackUrl).toBe('https://yourstore.shipway.com/t/1333110020164');
      expect(result.data.history.length).toBe(1);
    });
  });
});
