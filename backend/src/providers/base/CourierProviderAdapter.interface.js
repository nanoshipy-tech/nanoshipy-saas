'use strict';

const ProviderResponse = require('./ProviderResponse.dto');

/**
 * Custom error thrown when an abstract method has not been implemented.
 */
class MethodNotImplementedError extends Error {
  constructor(methodName) {
    super(`Method "${methodName}" must be implemented by the courier adapter subclass.`);
    this.name = 'MethodNotImplementedError';
  }
}

/**
 * CourierProviderAdapter
 *
 * @interface
 * @description Core architectural contract that all courier provider adapters MUST implement.
 * Downstream code only communicates via this interface, keeping the core platform entirely
 * decoupled from provider-specific APIs, SDKs, and payload quirks.
 */
class CourierProviderAdapter {
  /**
   * @param {object} credentials - Decrypted, provider-specific API credentials
   * @param {object} config - Non-secret configuration (base URLs, timeouts, etc.)
   */
  constructor(credentials, config) {
    if (this.constructor === CourierProviderAdapter) {
      throw new Error("CourierProviderAdapter is an abstract interface and cannot be instantiated directly.");
    }
    this.credentials = credentials;
    this.config = config;
  }

  /**
   * Check if a pickup and delivery pincode pair is serviceable by this courier.
   *
   * @param {object} params
   * @param {string} params.pickupPincode - Origin pincode
   * @param {string} params.deliveryPincode - Destination pincode
   * @param {number} params.weight - Package weight in kg
   * @param {string} params.paymentMode - 'prepaid' | 'cod'
   * @returns {Promise<ProviderResponse>} resolving to data: { serviceable: boolean, estimatedDays: number }
   * @throws {MethodNotImplementedError}
   */
  async checkServiceability({ pickupPincode, deliveryPincode, weight, paymentMode }) {
    throw new MethodNotImplementedError('checkServiceability');
  }

  /**
   * Fetch service availability and shipping rates for a parcel.
   *
   * @param {object} params
   * @param {string} params.pickupPincode - Origin pincode
   * @param {string} params.deliveryPincode - Destination pincode
   * @param {number} params.weight - Package weight in kg
   * @param {object} params.dimensions - Package dimensions in cm
   * @param {number} params.dimensions.length - Length
   * @param {number} params.dimensions.width - Width
   * @param {number} params.dimensions.height - Height
   * @param {string} params.paymentMode - 'prepaid' | 'cod'
   * @param {number} [params.codAmount=0] - Cash-on-delivery amount to collect if mode is COD
   * @returns {Promise<ProviderResponse>} resolving to data: { rates: [{ serviceType, courierName, price, estimatedDays, codCharge }] }
   * @throws {MethodNotImplementedError}
   */
  async getRates({ pickupPincode, deliveryPincode, weight, dimensions, paymentMode, codAmount }) {
    throw new MethodNotImplementedError('getRates');
  }

  /**
   * Book a shipment / create order in the courier's system and generate an AWB number.
   *
   * @param {object} params
   * @param {object} params.order - The order details to ship
   * @param {object} params.pickupAddress - Origin pickup address details
   * @param {string} params.serviceType - 'surface' | 'air' | 'express'
   * @returns {Promise<ProviderResponse>} resolving to data: { awbNumber, courierShipmentId, labelUrl, estimatedPickupDate }
   * @throws {MethodNotImplementedError}
   */
  async createShipment({ order, pickupAddress, serviceType }) {
    throw new MethodNotImplementedError('createShipment');
  }

  /**
   * Cancel an already created/booked shipment.
   *
   * @param {object} params
   * @param {string} params.awbNumber - The Air Waybill number
   * @returns {Promise<ProviderResponse>} resolving to data: { cancelled: boolean }
   * @throws {MethodNotImplementedError}
   */
  async cancelShipment({ awbNumber }) {
    throw new MethodNotImplementedError('cancelShipment');
  }

  /**
   * Track the current shipping status of a parcel using its AWB.
   *
   * @param {object} params
   * @param {string} params.awbNumber - The Air Waybill number
   * @returns {Promise<ProviderResponse>} resolving to data: { status, currentLocation, history: [{status, location, timestamp, remark}] }
   * @throws {MethodNotImplementedError}
   */
  async trackShipment({ awbNumber }) {
    throw new MethodNotImplementedError('trackShipment');
  }
  
  /**
   * Request shipment delivery reattempt from courier (optional).
   *
   * @param {object} params
   * @param {string} params.awbNumber - The Air Waybill number
   * @param {string} [params.updated_address_line1] - Optional updated address
   * @param {string} [params.updated_phone] - Optional updated phone
   * @returns {Promise<ProviderResponse>} resolving to data: { reattempted: boolean }
   * @throws {MethodNotImplementedError}
   */
  async requestReattempt({ awbNumber, updated_address_line1, updated_phone }) {
    // Optional feature - base class does not throw MethodNotImplementedError to allow standard fallback behavior
    return ProviderResponse.ok({ reattempted: false });
  }

  /**
   * Retrieve the shipping label PDF URL for a shipment.
   *
   * @param {object} params
   * @param {string} params.awbNumber - The Air Waybill number
   * @returns {Promise<ProviderResponse>} resolving to data: { labelUrl }
   * @throws {MethodNotImplementedError}
   */
  async generateLabel({ awbNumber }) {
    throw new MethodNotImplementedError('generateLabel');
  }

  /**
   * Perform an adapter-level integration health check.
   * Verify credentials and system availability.
   *
   * @returns {Promise<ProviderResponse>} resolving to data: { healthy: boolean, latencyMs: number }
   * @throws {MethodNotImplementedError}
   */
  async healthCheck() {
    throw new MethodNotImplementedError('healthCheck');
  }
}

module.exports = {
  CourierProviderAdapter,
  MethodNotImplementedError
};
