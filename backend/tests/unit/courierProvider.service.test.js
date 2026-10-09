'use strict';

const ProviderFactory = require('../../src/providers/ProviderFactory');
const { ProviderNotFoundError } = require('../../src/providers/errors');
const providerCredentialService = require('../../src/services/providerCredential.service');
const MockProviderAdapter = require('../../src/providers/mock/MockProviderAdapter');
const ProviderResponse = require('../../src/providers/base/ProviderResponse.dto');
const { CourierProviderAdapter } = require('../../src/providers/base/CourierProviderAdapter.interface');

describe('Courier Provider Adapter & Service (Unit)', () => {
  
  describe('ProviderFactory', () => {
    it('should resolve the correct MockProviderAdapter class for key "mock"', async () => {
      const credentials = { api_key: 'test', api_secret: 'secret' };
      const config = { base_url: 'https://test' };
      const adapter = await ProviderFactory.getAdapter('mock', credentials, config);
      expect(adapter).toBeInstanceOf(MockProviderAdapter);
      expect(adapter.credentials).toEqual(credentials);
      expect(adapter.config).toEqual(config);
    });

    it('should throw ProviderNotFoundError for unregistered keys', async () => {
      await expect(
        ProviderFactory.getAdapter('unregistered_courier', {}, {})
      ).rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('ProviderCredentialService Encryption', () => {
    it('should successfully encrypt and decrypt a credentials object', () => {
      const credentials = {
        api_key: 'xyz-api-key-value',
        api_secret: 'abc-api-secret-value-long',
      };

      const encrypted = providerCredentialService.encrypt(credentials);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':'); // IV:Ciphertext:Tag structure

      const decrypted = providerCredentialService.decrypt(encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it('should return empty string or null for empty values', () => {
      expect(providerCredentialService.encrypt(null)).toBe('');
      expect(providerCredentialService.decrypt('')).toBeNull();
    });

    it('should throw error for malformed encrypted data', () => {
      expect(() => {
        providerCredentialService.decrypt('malformed-string-no-parts');
      }).toThrow(/Invalid encrypted credentials format/);
    });
  });

  describe('Courier Adapter Contract Tests', () => {
    // Generic runner to assert compliance with the interface
    function runAdapterContractTests(AdapterClass) {
      const dummyCreds = { api_key: 't', api_secret: 's' };
      const dummyConfig = { c: 'v' };
      const adapterInstance = new AdapterClass(dummyCreds, dummyConfig);

      it('should be a subclass of CourierProviderAdapter', () => {
        expect(adapterInstance).toBeInstanceOf(CourierProviderAdapter);
      });

      const requiredMethods = [
        'checkServiceability',
        'getRates',
        'createShipment',
        'cancelShipment',
        'trackShipment',
        'generateLabel',
        'healthCheck'
      ];

      requiredMethods.forEach(method => {
        it(`should implement method "${method}"`, () => {
          expect(typeof adapterInstance[method]).toBe('function');
        });
      });
    }

    // Run the contract test suite against the Mock provider
    runAdapterContractTests(MockProviderAdapter);
  });

  describe('MockProviderAdapter Methods Output', () => {
    let adapter;

    beforeAll(() => {
      adapter = new MockProviderAdapter({ api_key: 'key' }, {});
    });

    it('checkServiceability returns conforming response', async () => {
      const res = await adapter.checkServiceability({
        pickupPincode: '400001',
        deliveryPincode: '110001',
        weight: 1.5,
        paymentMode: 'prepaid'
      });
      expect(res).toBeInstanceOf(ProviderResponse);
      expect(res.success).toBe(true);
      expect(res.data.serviceable).toBe(true);
    });

    it('getRates returns rates payload', async () => {
      const res = await adapter.getRates({
        pickupPincode: '400001',
        deliveryPincode: '110001',
        weight: 2.0,
        dimensions: { length: 10, width: 10, height: 10 },
        paymentMode: 'prepaid'
      });
      expect(res.success).toBe(true);
      expect(res.data.rates.length).toBeGreaterThan(0);
      expect(res.data.rates[0].price).toBeDefined();
    });

    it('createShipment returns awb tracking credentials', async () => {
      const res = await adapter.createShipment({
        order: { order_reference: 'ORD-123', order_value: 500 },
        pickupAddress: { pincode: '400001' },
        serviceType: 'express'
      });
      expect(res.success).toBe(true);
      expect(res.data.awbNumber).toMatch(/^MOCK-/);
    });
  });
});
