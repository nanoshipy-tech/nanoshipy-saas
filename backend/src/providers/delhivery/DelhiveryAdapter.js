'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./delhiveryResponseMapper');
const logger = require('../../utils/logger');

class DelhiveryAdapter extends CourierProviderAdapter {
  constructor(credentials, config) {
    super(credentials, config);
    
    // Choose base URL based on sandbox mode
    const defaultSandboxUrl = 'https://staging-express.delhivery.com/api/v1';
    const defaultLiveUrl = 'https://track.delhivery.com/api/v1';
    
    const baseUrl = this.config.sandbox_mode
      ? (process.env.DELHIVERY_SANDBOX_BASE_URL || defaultSandboxUrl)
      : (process.env.DELHIVERY_LIVE_BASE_URL || defaultLiveUrl);
      
    this.client = createClient(baseUrl, this.config.timeout_ms || 5000);
    this.providerKey = 'delhivery';
  }

  /**
   * Helper to format request errors into standard ProviderErrors.
   */
  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }
    
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.error_message || data.message || err.message;
      const code = data.error_code || data.code || null;

      if (status === 401 || status === 403 || code === 'AUTH_FAILED') {
        return new ProviderError('AUTH_FAILED', msg, {}, code);
      }
      if (status === 429 || code === 'RATE_LIMIT') {
        return new ProviderError('RATE_LIMIT', msg, {}, code);
      }
      if (status >= 500) {
        return new ProviderError('SERVICE_UNAVAILABLE', msg, {}, code);
      }
      return new ProviderError('UNKNOWN', msg, {}, code);
    }
    
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return new ProviderError('SERVICE_UNAVAILABLE', 'Connection timed out', {}, 'TIMEOUT');
    }
    return new ProviderError('UNKNOWN', err.message);
  }

  async checkServiceability({ pickupPincode, deliveryPincode, weight, paymentMode }) {
    const apiCall = async () => {
      const response = await this.client.post('/serviceability', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        pickup_pincode: pickupPincode,
        delivery_pincode: deliveryPincode,
        weight,
        payment_mode: paymentMode,
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      
      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success status flag');
      }

      if (!raw.success) {
        const category = raw.error_code === 'INVALID_PINCODE' ? 'INVALID_PINCODE' : 'UNKNOWN';
        return ProviderResponse.fail(new ProviderError(category, raw.error_message || 'Serviceability check failed', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      if (data.serviceable === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing serviceable attribute');
      }

      return ProviderResponse.ok({
        serviceable: !!data.serviceable,
        estimatedDays: Number(data.estimated_days || 0),
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async getRates({ pickupPincode, deliveryPincode, weight, dimensions, paymentMode, codAmount }) {
    const apiCall = async () => {
      const response = await this.client.post('/get-rates', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        pickup_pincode: pickupPincode,
        delivery_pincode: deliveryPincode,
        weight,
        length: dimensions?.length || 0,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        payment_mode: paymentMode,
        cod_amount: codAmount || 0,
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      
      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', raw.error_message || 'Failed to fetch rates', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      if (!Array.isArray(data.rates)) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Rates must be an array');
      }

      const mappedRates = data.rates.map((r, idx) => {
        if (!r.service_type || r.price === undefined) {
          throw new ProviderResponseMalformedError(this.providerKey, `Rate item at index ${idx} is missing service_type or price`);
        }
        return {
          serviceType: r.service_type,
          courierName: r.courier_name || 'Delhivery Partner',
          price: Number(r.price),
          estimatedDays: Number(r.estimated_days || 5),
          codCharge: Number(r.cod_charge || 0),
        };
      });

      return ProviderResponse.ok({ rates: mappedRates }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async createShipment({ order, pickupAddress, serviceType }) {
    const apiCall = async () => {
      const response = await this.client.post('/create-shipment', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        order_id: order.id,
        service_type: serviceType,
        pickup_address: pickupAddress,
        order_details: {
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          delivery_address: order.delivery_address,
          delivery_pincode: order.delivery_pincode,
          weight: order.weight,
          payment_mode: order.payment_mode,
          cod_amount: order.cod_amount,
        }
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      
      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', raw.error_message || 'Failed to create shipment', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      if (!data.awb_number) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing awb_number in response data');
      }

      return ProviderResponse.ok({
        awbNumber: data.awb_number,
        courierShipmentId: data.courier_shipment_id || null,
        labelUrl: data.label_url || null,
        estimatedPickupDate: data.estimated_pickup_date || null,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async cancelShipment({ awbNumber }) {
    const apiCall = async () => {
      const response = await this.client.post('/cancel-shipment', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        awb_number: awbNumber,
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        const category = raw.error_code === 'SHIPMENT_NOT_FOUND' ? 'SHIPMENT_NOT_FOUND' : 'UNKNOWN';
        return ProviderResponse.fail(new ProviderError(category, raw.error_message || 'Failed to cancel shipment', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      return ProviderResponse.ok({
        cancelled: !!data.cancelled,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async trackShipment({ awbNumber }) {
    const apiCall = async () => {
      const response = await this.client.post('/track', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        awb_number: awbNumber,
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        const category = raw.error_code === 'SHIPMENT_NOT_FOUND' ? 'SHIPMENT_NOT_FOUND' : 'UNKNOWN';
        return ProviderResponse.fail(new ProviderError(category, raw.error_message || 'Tracking lookup failed', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      if (!data.status) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing status in response data');
      }

      const mappedStatus = mapStatus(data.status);
      const rawHistory = data.history || [];
      const history = rawHistory.map(h => ({
        status: mapStatus(h.status),
        location: h.location || 'Unknown',
        timestamp: h.timestamp || new Date().toISOString(),
        remark: h.remark || '',
      }));

      return ProviderResponse.ok({
        status: mappedStatus,
        currentLocation: data.current_location || 'Unknown',
        history,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async generateLabel({ awbNumber }) {
    const apiCall = async () => {
      const response = await this.client.post('/generate-label', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
        awb_number: awbNumber,
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', raw.error_message || 'Label generation failed', {}, raw.error_code), raw);
      }

      const data = raw.data || {};
      if (!data.label_url) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing label_url in response data');
      }

      return ProviderResponse.ok({
        labelUrl: data.label_url,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async healthCheck() {
    const apiCall = async () => {
      const response = await this.client.post('/health', {
        api_token: this.credentials.api_token,
        client_name: this.credentials.client_name,
      });
      return response.data;
    };

    try {
      const startTime = Date.now();
      const raw = await executeWithRetry(apiCall);
      const latencyMs = Date.now() - startTime;

      if (!raw || raw.success === undefined) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing success flag in response');
      }

      if (!raw.success) {
        return ProviderResponse.fail(new ProviderError('SERVICE_UNAVAILABLE', raw.error_message || 'Health check rejected credentials', {}, raw.error_code), raw);
      }

      return ProviderResponse.ok({
        healthy: !!raw.success,
        latencyMs,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Forward NDR instructions to Delhivery NDR API.
   */
  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const payload = {
        waybill: awbNumber,
        action: action_type === 'mark_rto' ? 'RTO' : 'RE-ATTEMPT',
        address: updated_address_line1 || undefined,
        phone: updated_phone || undefined,
        remarks: notes || 'Delivery reattempt requested via Nanoshipy NDR panel',
      };

      logger.info(`[DelhiveryAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post('/packages/json/', payload, {
        headers: {
          'Authorization': `Token ${this.credentials?.api_token || this.credentials?.api_key || ''}`,
          'Content-Type': 'application/json',
        },
      });

      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.status || 'ok' });
    } catch (err) {
      logger.warn(`[DelhiveryAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = DelhiveryAdapter;
