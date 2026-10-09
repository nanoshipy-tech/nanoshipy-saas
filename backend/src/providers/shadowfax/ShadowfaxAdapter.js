'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./shadowfaxResponseMapper');
const logger = require('../../utils/logger');

class ShadowfaxAdapter extends CourierProviderAdapter {
  constructor(credentials, config = {}) {
    super(credentials, config);

    const defaultSandboxUrl = 'https://flash-staging.shadowfax.in/api/v2';
    const defaultLiveUrl = 'https://flash.shadowfax.in/api/v2';

    const baseUrl = this.config.sandbox_mode
      ? (process.env.SHADOWFAX_SANDBOX_BASE_URL || defaultSandboxUrl)
      : (process.env.SHADOWFAX_LIVE_BASE_URL || defaultLiveUrl);

    this.client = createClient(baseUrl, this.config.timeout_ms || 8000);
    this.providerKey = 'shadowfax';
  }

  _validateCredentials() {
    const creds = this.credentials || {};
    if (!creds.token && !creds.api_key) {
      return new ProviderError('AUTH_FAILED', 'Shadowfax credentials missing: require token or api_key');
    }
    return null;
  }

  _getAuthHeaders() {
    const token = this.credentials?.token || this.credentials?.api_key || '';
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Token ${token}`,
    };
  }

  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.message || data.error || (data.errors ? JSON.stringify(data.errors) : err.message);
      const code = data.code || null;

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
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.get('/clients/serviceability', {
        headers: this._getAuthHeaders(),
        params: {
          pickup_pincode: pickupPincode,
          delivery_pincode: deliveryPincode,
          payment_mode: paymentMode === 'cod' ? 'cod' : 'prepaid',
        }
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const isServiceable = raw?.serviceable === true || raw?.data?.serviceable === true;
      const estDays = Number(raw?.delivery_days || raw?.data?.delivery_days || 3);

      return ProviderResponse.ok({
        serviceable: isServiceable,
        estimatedDays: estDays,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async getRates({ pickupPincode, deliveryPincode, weight, dimensions, paymentMode, codAmount }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const payload = {
        pickup_pincode: pickupPincode,
        delivery_pincode: deliveryPincode,
        weight: weight || 0.5,
        payment_mode: paymentMode === 'cod' ? 'cod' : 'prepaid',
        cod_amount: codAmount || 0,
      };
      const response = await this.client.post('/clients/price-estimate', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const basePrice = Number(raw?.price || raw?.data?.price || 55);
      const codCharge = paymentMode === 'cod' ? (codAmount > 1000 ? Math.round(codAmount * 0.02) : 30) : 0;

      const mappedRates = [
        {
          serviceType: 'surface',
          courierName: 'Shadowfax Surface',
          price: basePrice,
          estimatedDays: Number(raw?.delivery_days || 3),
          codCharge,
        },
        {
          serviceType: 'express',
          courierName: 'Shadowfax Hyper/Express',
          price: Math.round(basePrice * 1.3),
          estimatedDays: 2,
          codCharge,
        }
      ];

      return ProviderResponse.ok({ rates: mappedRates }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async createShipment({ order, pickupAddress, serviceType }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const payload = {
        order_details: {
          client_order_id: String(order.id || `ORD-${Date.now()}`),
          actual_weight: order.weight || 0.5,
          order_type: order.payment_mode === 'cod' ? 'cod' : 'prepaid',
          total_amount: order.payment_mode === 'cod' ? (order.cod_amount || 0) : 0,
          product_value: order.declared_value || order.cod_amount || 500,
        },
        delivery_details: {
          name: order.customer_name,
          phone_number: order.customer_phone,
          address_line_1: order.delivery_address?.substring(0, 100) || '',
          pincode: order.delivery_pincode,
          city: order.city || 'City',
          state: order.state || 'State',
        },
        pickup_details: {
          name: pickupAddress?.name || 'Warehouse',
          phone_number: pickupAddress?.phone || '',
          address_line_1: pickupAddress?.address_line1 || '',
          pincode: pickupAddress?.pincode || '',
        }
      };

      const response = await this.client.post('/clients/orders', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const awb = raw?.data?.awb_number || raw?.awb_number || raw?.data?.sfx_order_id || raw?.sfx_order_id;

      if (!awb) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', raw?.message || 'Failed to generate Shadowfax AWB', {}, 'AWB_GENERATION_FAILED'), raw);
      }

      return ProviderResponse.ok({
        awbNumber: String(awb),
        courierShipmentId: String(raw?.data?.sfx_order_id || awb),
        labelUrl: raw?.data?.label_url || raw?.label_url || null,
        estimatedPickupDate: raw?.data?.pickup_date || new Date().toISOString(),
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async cancelShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.post(`/clients/orders/${awbNumber}/cancel`, {}, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const cancelled = raw?.success === true || raw?.status === 'cancelled';
      return ProviderResponse.ok({ cancelled: !!cancelled }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async trackShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.get(`/clients/orders/${awbNumber}/track`, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const data = raw?.data || raw || {};
      const rawScans = data.tracking_details || data.history || [];
      const currentRawStatus = data.status || (rawScans[0]?.status) || 'in_transit';
      const mappedStatus = mapStatus(currentRawStatus);

      const history = rawScans.map(s => ({
        status: mapStatus(s.status),
        location: s.location || 'Unknown',
        timestamp: s.created_at || s.timestamp || new Date().toISOString(),
        remark: s.message || s.remark || '',
      }));

      return ProviderResponse.ok({
        status: mappedStatus,
        currentLocation: data.current_location || history[0]?.location || 'Unknown',
        history,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async generateLabel({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.get(`/clients/orders/${awbNumber}/label`, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const labelUrl = raw?.label_url || raw?.data?.label_url;
      if (!labelUrl) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing label_url in Shadowfax response');
      }
      return ProviderResponse.ok({ labelUrl }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async healthCheck() {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    try {
      const startTime = Date.now();
      await this.client.get('/clients/serviceability', {
        headers: this._getAuthHeaders(),
        params: { pickup_pincode: '110001', delivery_pincode: '560001' },
      });
      const latencyMs = Date.now() - startTime;
      return ProviderResponse.ok({ healthy: true, latencyMs });
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const payload = {
        action: action_type === 'mark_rto' ? 'RTO' : 'RETRY',
        address: updated_address_line1 || undefined,
        contact_number: updated_phone || undefined,
        remark: notes || 'Delivery reattempt requested via Nanoshipy NDR',
      };
      logger.info(`[ShadowfaxAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post(`/clients/orders/${awbNumber}/ndr-action`, payload, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.status || 'ok' });
    } catch (err) {
      logger.warn(`[ShadowfaxAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = ShadowfaxAdapter;
