const assert = require('assert');
const labelGenerationService = require('../../src/services/labelGeneration.service');
const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');

describe('Verification of 4 Bug Fixes', () => {
  describe('Fix 3: Label Carrier & Variant Badge Mapping', () => {
    it('should correctly format 7377 as BLUE DART • EXPRESS', () => {
      const badge = labelGenerationService.getCleanCarrierBadge(null, {
        service_type: '7377',
      });
      assert.strictEqual(badge, 'BLUE DART • EXPRESS');
    });

    it('should correctly format 81769 as BLUE DART • SURFACE', () => {
      const badge = labelGenerationService.getCleanCarrierBadge(null, {
        service_type: '81769',
      });
      assert.strictEqual(badge, 'BLUE DART • SURFACE');
    });

    it('should correctly format 7442 as DELHIVERY • EXPRESS', () => {
      const badge = labelGenerationService.getCleanCarrierBadge(null, {
        service_type: '7442',
      });
      assert.strictEqual(badge, 'DELHIVERY • EXPRESS');
    });

    it('should correctly format 80622 as DELHIVERY • SURFACE', () => {
      const badge = labelGenerationService.getCleanCarrierBadge(null, {
        service_type: '80622',
      });
      assert.strictEqual(badge, 'DELHIVERY • SURFACE');
    });

    it('should correctly format 80652 as XPRESSBEES • EXPRESS', () => {
      const badge = labelGenerationService.getCleanCarrierBadge(null, {
        service_type: '80652',
      });
      assert.strictEqual(badge, 'XPRESSBEES • EXPRESS');
    });
  });

  describe('Fix 2: Dimensions & Volumetric Weight in ShipwayAdapter', () => {
    it('should accurately calculate volumetric billable weight and preserve user dimensions', async () => {
      const adapter = new ShipwayAdapter({
        username: 'test@example.com',
        license_key: 'test_key',
      });

      let capturedPayload = null;
      adapter.client = {
        post: async (url, payload) => {
          capturedPayload = payload;
          return {
            data: {
              success: true,
              awb_response: {
                AWB: '9988776655',
                carrier_id: 7377,
                carrier_name: 'Bluedart',
              },
            },
          };
        },
      };

      await adapter.createShipment({
        order: {
          id: 'ord-123',
          order_reference: 'WB-TEST-25X',
          customer_name: 'Test Customer',
          customer_phone: '9999999999',
          delivery_address: 'Test Destination Address',
          delivery_pincode: '560001',
          order_value: 500,
          payment_mode: 'prepaid',
          weight: 2.0, // 2kg dead weight
          length_cm: 25,
          width_cm: 25,
          height_cm: 25,
        },
        pickupAddress: {
          shipway_location_id: '105530',
        },
        serviceType: '7377',
      });

      assert(capturedPayload !== null, 'capturedPayload should not be null');
      assert.strictEqual(capturedPayload.box_length, 25);
      assert.strictEqual(capturedPayload.box_breadth, 25);
      assert.strictEqual(capturedPayload.box_height, 25);
      // Volumetric weight for 25x25x25 = (15625 / 5000) = 3.125kg = 3125 grams
      // Dead weight = 2000 grams
      // Billable weight = max(2000, 3125) = 3125 grams
      assert.strictEqual(capturedPayload.order_weight, 3125);
    });
  });

  describe('Fix 5: Customer Receipt Courier Name Resolution', () => {
    const { resolveConcernedCourierName, getCleanCarrierName } = require('../../src/services/receiptPdf.service');

    it('should resolve Blue Dart Express for service_type 7377 instead of Shipway Multi-Carrier', async () => {
      const mockShipment = {
        awb_number: '90668242055',
        service_type: '7377',
        provider: {
          display_name: 'Shipway Multi-Carrier',
          provider_key: 'shipway',
        },
        provider_raw_response: {
          awb_response: {
            carrier_id: '7377',
            carrier_name: 'BlueDart',
          },
        },
      };

      const courierName = await resolveConcernedCourierName(mockShipment);
      assert.strictEqual(courierName, 'Blue Dart • Express');
      assert.strictEqual(getCleanCarrierName(mockShipment), 'Blue Dart • Express');
    });

    it('should resolve Delhivery Express for service_type 7442 instead of Shipway Multi-Carrier', async () => {
      const mockShipment = {
        awb_number: '11633338078761',
        service_type: '7442',
        provider: {
          display_name: 'Shipway Multi-Carrier',
          provider_key: 'shipway',
        },
        provider_raw_response: {
          awb_response: {
            carrier_id: '7442',
            carrier_name: 'Delhivery',
          },
        },
      };

      const courierName = await resolveConcernedCourierName(mockShipment);
      assert.strictEqual(courierName, 'Delhivery • Express');
      assert.strictEqual(getCleanCarrierName(mockShipment), 'Delhivery • Express');
    });

    it('should resolve ST Courier for intra-state bookings', async () => {
      const mockShipment = {
        awb_number: 'CH343500002',
        service_type: 'st_courier_surface',
        provider: {
          display_name: 'ST Courier (Tamil Nadu Express)',
          provider_key: 'stcourier',
        },
      };

      const courierName = await resolveConcernedCourierName(mockShipment);
      assert.strictEqual(courierName, 'ST Courier');
      assert.strictEqual(getCleanCarrierName(mockShipment), 'ST Courier');
    });

    it('should never output Shipway Multi-Carrier even with unmapped raw response', async () => {
      const mockShipment = {
        awb_number: '9999999999',
        service_type: 'surface',
        provider: {
          display_name: 'Shipway Multi-Carrier',
          provider_key: 'shipway',
        },
        provider_raw_response: {},
      };

      const courierName = await resolveConcernedCourierName(mockShipment);
      assert.notStrictEqual(courierName, 'Shipway Multi-Carrier');
      assert.strictEqual(courierName.includes('Shipway'), false);
    });
  });
});
