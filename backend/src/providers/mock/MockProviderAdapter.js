'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');

/**
 * MockProviderAdapter
 *
 * Fully implements CourierProviderAdapter contract. Simulates responses deterministically.
 */
class MockProviderAdapter extends CourierProviderAdapter {
  constructor(credentials, config) {
    super(credentials, config);
  }

  /**
   * Check serviceability.
   * Invalidates delivery Pincode '999999' as unserviceable.
   */
  async checkServiceability({ pickupPincode, deliveryPincode, weight, paymentMode }) {
    try {
      if (deliveryPincode === '999999') {
        return ProviderResponse.ok({ serviceable: false, estimatedDays: 0 });
      }
      return ProviderResponse.ok({ serviceable: true, estimatedDays: 3 });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Get rates.
   * Pricing heuristics based on weight.
   */
  async getRates({ pickupPincode, deliveryPincode, weight, dimensions, paymentMode, codAmount }) {
    try {
      if (deliveryPincode === '999999') {
        return ProviderResponse.fail(new ProviderError('INVALID_PINCODE', 'Delivery location not serviceable.'));
      }
      
      const w = parseFloat(weight) || 1.0;
      const codCharge = paymentMode === 'cod' ? 50 : 0;

      const rates = [
        {
          serviceType: 'surface',
          courierName: 'Mock Surface Express',
          price: Math.round((w * 40 + 60) * 100) / 100,
          estimatedDays: 5,
          codCharge
        },
        {
          serviceType: 'express',
          courierName: 'Mock Air Express',
          price: Math.round((w * 90 + 120) * 100) / 100,
          estimatedDays: 2,
          codCharge
        }
      ];

      return ProviderResponse.ok({ rates });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Create shipment.
   */
  async createShipment({ order, pickupAddress, serviceType }) {
    try {
      const timestamp = Date.now();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const awbNumber = `MOCK-${timestamp}-${rand}`;
      
      return ProviderResponse.ok({
        awbNumber,
        courierShipmentId: `MSHIP-${timestamp}`,
        labelUrl: 'https://shippingsaas-mock-labels.s3.amazonaws.com/label.pdf',
        estimatedPickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Cancel shipment.
   */
  async cancelShipment({ awbNumber }) {
    try {
      if (!awbNumber) {
        return ProviderResponse.fail(new ProviderError('SHIPMENT_NOT_FOUND', `AWB ${awbNumber} not found.`));
      }
      return ProviderResponse.ok({ cancelled: true });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Track shipment.
   */
  async trackShipment({ awbNumber }) {
    try {
      if (!awbNumber || !awbNumber.startsWith('MOCK-')) {
        return ProviderResponse.fail(new ProviderError('SHIPMENT_NOT_FOUND', `AWB ${awbNumber} not found.`));
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const history = [
        { status: 'pending', location: 'Merchant Warehouse', timestamp: twoDaysAgo.toISOString(), remark: 'Shipment created and registered' },
        { status: 'picked_up', location: 'Mumbai Sorting Hub', timestamp: yesterday.toISOString(), remark: 'Parcel received at sorting facility' },
        { status: 'in_transit', location: 'Delhi Hub', timestamp: now.toISOString(), remark: 'Shipment in transit to destination' }
      ];

      return ProviderResponse.ok({
        status: 'in_transit',
        currentLocation: 'Delhi Hub',
        history
      });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Request delivery reattempt (Mock).
   */
  async requestReattempt({ awbNumber, updated_address_line1, updated_phone }) {
    try {
      if (!awbNumber || !awbNumber.startsWith('MOCK-')) {
        return ProviderResponse.fail(new ProviderError('SHIPMENT_NOT_FOUND', `AWB ${awbNumber} not found.`));
      }
      return ProviderResponse.ok({ reattempted: true });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Generate label.
   */
  async generateLabel({ awbNumber }) {
    try {
      if (!awbNumber || !awbNumber.startsWith('MOCK-')) {
        return ProviderResponse.fail(new ProviderError('SHIPMENT_NOT_FOUND', `AWB ${awbNumber} not found.`));
      }
      return ProviderResponse.ok({
        labelUrl: 'https://shippingsaas-mock-labels.s3.amazonaws.com/label.pdf'
      });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('UNKNOWN', err.message));
    }
  }

  /**
   * Health check.
   */
  async healthCheck() {
    try {
      // Simulate healthy state with brief latency
      return ProviderResponse.ok({ healthy: true, latencyMs: 22 });
    } catch (err) {
      return ProviderResponse.fail(new ProviderError('SERVICE_UNAVAILABLE', err.message));
    }
  }
}

module.exports = MockProviderAdapter;
