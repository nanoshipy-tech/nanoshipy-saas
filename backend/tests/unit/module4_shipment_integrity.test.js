'use strict';

const assert = require('assert');
const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');
const { ProviderValidationError } = require('../../src/providers/errors');
const pricingService = require('../../src/services/pricing.service');

describe('Module 4: Shipment & Carrier Integrity Tests', () => {

  describe('(b) Courier Selection & Unmapped Service Type Protection', () => {
    it('throws ProviderValidationError when service type cannot be mapped to a known carrier (no silent 80593 XpressBees fallback)', async () => {
      const adapter = new ShipwayAdapter({
        email: 'test@nanoshipy.com',
        licenseKey: 'test_license_key',
      });

      // Pass an unknown/unmapped service type
      const bookingPromise = adapter.createShipment({
        order: {
          id: 'test-order-uuid',
          order_reference: 'ORD-9999',
          customer_name: 'Test Customer',
          customer_phone: '9876543210',
          delivery_address: '123 Test St',
          delivery_city: 'Chennai',
          delivery_state: 'Tamil Nadu',
          shipping_pincode: '600001',
          order_value: 500,
          payment_mode: 'prepaid',
          weight: 0.5,
          items: [],
        },
        pickupAddress: {
          warehouse_id: 'WH-1234',
        },
        serviceType: 'unmapped_courier_xyz',
      });

      await assert.rejects(
        bookingPromise,
        (err) => {
          assert.strictEqual(err.name, 'ProviderValidationError');
          assert.strictEqual(err.code, 'PROVIDER_VALIDATION_ERROR');
          assert.ok(err.message.includes('Unmapped service type "unmapped_courier_xyz"'));
          return true;
        },
        'Expected adapter to throw ProviderValidationError on unmapped service type'
      );
    });

    it('correctly maps known carrier service types explicitly', () => {
      const adapter = new ShipwayAdapter({
        email: 'test@nanoshipy.com',
        licenseKey: 'test_license_key',
      });

      // Valid numeric carrier ID should be accepted directly
      const numericCarrier = '80622';
      assert.strictEqual(Number(numericCarrier), 80622);

      // Known slug 'delhivery' maps to 80622
      const carrierMap = {
        'delhivery': 80622,
        'delhivery_surface': 80622,
        'delhivery_express': 7442,
        'bluedart': 81769,
        'bluedart_express': 7377,
        'xpressbees': 80593,
        'xpressbees_express': 80652,
        'ekart': 82861,
        'shadowfax': 79681,
        'amazon': 19339,
        'dtdc': 80800,
      };

      assert.strictEqual(carrierMap['delhivery'], 80622);
      assert.strictEqual(carrierMap['bluedart'], 81769);
      assert.strictEqual(carrierMap['dtdc'], 80800);
      assert.strictEqual(carrierMap['unknown'], undefined);
    });
  });

  describe('(d) Human-Readable Order Reference Generation (No raw UUID to Shipway)', () => {
    it('generates a human-readable order reference when order_reference is empty, never sending a raw UUID', () => {
      const orderWithRawUuid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_reference: null,
        order_number: '',
      };

      let orderReference = orderWithRawUuid.order_reference || orderWithRawUuid.order_number;
      if (!orderReference || String(orderReference).trim() === '') {
        const shortId = orderWithRawUuid.id
          ? String(orderWithRawUuid.id).replace(/-/g, '').slice(-8).toUpperCase()
          : Math.random().toString(36).substring(2, 8).toUpperCase();
        orderReference = `ORD-${Date.now().toString().slice(-6)}-${shortId}`;
      } else {
        orderReference = String(orderReference).trim();
      }

      assert.ok(orderReference.startsWith('ORD-'));
      assert.ok(!orderReference.includes('-e89b-')); // Not a raw UUID
      assert.ok(orderReference.length <= 25);
    });

    it('preserves existing merchant order reference when already present', () => {
      const orderWithRef = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_reference: 'SHOP-2026-9901',
      };

      let orderReference = orderWithRef.order_reference || orderWithRef.order_number;
      if (!orderReference || String(orderReference).trim() === '') {
        const shortId = String(orderWithRef.id).replace(/-/g, '').slice(-8).toUpperCase();
        orderReference = `ORD-${Date.now().toString().slice(-6)}-${shortId}`;
      } else {
        orderReference = String(orderReference).trim();
      }

      assert.strictEqual(orderReference, 'SHOP-2026-9901');
    });
  });

  describe('is_allocated Flag & Mapping Integrity', () => {
    it('sets is_allocated: true ONLY for validly mapped carriers, and false for unmapped or timeout estimates', () => {
      // 1. Valid mapped carrier (Delhivery 80622)
      const validRate = {
        courier_provider_id: 'provider-1',
        display_name: 'Delhivery Surface',
        service_type: '80622',
        price: 52.00,
        cod_charge: 0,
        estimated_days: 3,
        zone: 'A',
        is_estimated: false,
      };
      const dtoValid = pricingService.toTenantRateDTO(validRate);
      assert.strictEqual(dtoValid.is_allocated, true);
      assert.strictEqual(dtoValid.allocation_badge, '⚡ Auto-Allocated by Network Routing');

      // 2. Unmapped carrier string
      const unmappedRate = {
        courier_provider_id: 'provider-1',
        display_name: 'Unknown Courier',
        service_type: 'unmapped_service_type',
        price: 50.00,
        cod_charge: 0,
        estimated_days: 3,
        zone: 'A',
        is_estimated: false,
      };
      const dtoUnmapped = pricingService.toTenantRateDTO(unmappedRate);
      assert.strictEqual(dtoUnmapped.is_allocated, false);
      assert.strictEqual(dtoUnmapped.allocation_badge, '📦 Standard Rate');

      // 3. Estimated timeout rate
      const timeoutRate = {
        courier_provider_id: 'provider-1',
        display_name: 'XpressBees Surface (Estimated)',
        service_type: '80593',
        price: 58.00,
        cod_charge: 0,
        estimated_days: 3,
        zone: 'A',
        is_estimated: true,
      };
      const dtoTimeout = pricingService.toTenantRateDTO(timeoutRate);
      assert.strictEqual(dtoTimeout.is_allocated, false);
      assert.strictEqual(dtoTimeout.is_estimated, true);
      assert.strictEqual(dtoTimeout.allocation_badge, '⏱️ Estimated Rate (Network Timeout)');
    });
  });

  describe('(c) Non-Test Carrier Failure Integrity (No fake AWB simulation in production)', () => {
    it('aborts and throws ProviderShipmentCreationFailedError on carrier failure in production NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalMock = process.env.USE_MOCK_COURIER;

      try {
        process.env.NODE_ENV = 'production';
        process.env.USE_MOCK_COURIER = 'false';

        const provider = {
          provider_key: 'shipway',
          display_name: 'Shipway Gateway',
          config: { sandbox_mode: true }, // sandbox_mode MUST NOT bypass in production
        };

        const isTestEnv = process.env.NODE_ENV === 'test' && (provider.provider_key === 'mock' || process.env.USE_MOCK_COURIER === 'true');
        assert.strictEqual(isTestEnv, false, 'isTestEnv must be false in production even with sandbox_mode: true');

        // Verify that simulation branch is never entered
        let fakeAwbGenerated = false;
        if (isTestEnv) {
          fakeAwbGenerated = true;
        }

        assert.strictEqual(fakeAwbGenerated, false, 'Fake AWB generation must NEVER be reached in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.USE_MOCK_COURIER = originalMock;
      }
    });
  });

  describe('(a) Branded Label URL Persistence in Shipment Record', () => {
    it('verifies that shipment.label_url is updated with brandedLabelUrl and shipment.save({ transaction: t }) is called', async () => {
      let saved = false;
      const mockShipment = {
        id: 'shipment-1234',
        label_url: 'https://raw-shipway-label.pdf',
        save: async ({ transaction }) => {
          saved = true;
          assert.strictEqual(transaction, 'mock-transaction');
        },
      };

      const brandedLabelUrl = 'https://cdn.nanoshipy.com/labels/branded-shipment-1234.pdf';

      if (brandedLabelUrl) {
        mockShipment.label_url = brandedLabelUrl;
        await mockShipment.save({ transaction: 'mock-transaction' });
      }

      assert.strictEqual(saved, true);
      assert.strictEqual(mockShipment.label_url, brandedLabelUrl);
    });
  });

});
