'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./xpressbeesResponseMapper');
const logger = require('../../utils/logger');

class XpressbeesAdapter extends CourierProviderAdapter {
  constructor(credentials, config = {}) {
    super(credentials, config);

    const defaultSandboxUrl = 'https://shipment.xpressbees.com/api';
    const defaultLiveUrl = 'https://shipment.xpressbees.com/api';

    const baseUrl = this.config.sandbox_mode
      ? (process.env.XPRESSBEES_SANDBOX_BASE_URL || defaultSandboxUrl)
      : (process.env.XPRESSBEES_LIVE_BASE_URL || defaultLiveUrl);

    this.client = createClient(baseUrl, this.config.timeout_ms || 8000);
    this.providerKey = 'xpressbees';
    this._token = this.credentials?.token || this.credentials?.api_key || null;
  }

  _validateCredentials() {
    const creds = this.credentials || {};
    if (!creds.token && !creds.api_key && (!creds.email || !creds.password)) {
      return new ProviderError('AUTH_FAILED', 'Xpressbees credentials missing: require token/api_key or email and password');
    }
    return null;
  }

  async _getToken() {
    if (this._token) return this._token;
    const creds = this.credentials || {};
    if (creds.token || creds.api_key) {
      this._token = creds.token || creds.api_key;
      return this._token;
    }

    // Attempt login
    const resp = await this.client.post('/users/customer_login', {
      email: creds.email,
      password: creds.password,
    });
    if (resp.data?.data) {
      this._token = resp.data.data;
      return this._token;
    }
    throw new ProviderError('AUTH_FAILED', 'Failed to authenticate with Xpressbees');
  }

  async _getAuthHeaders() {
    const token = await this._getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.message || data.error || err.message;
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
      const headers = await this._getAuthHeaders();
      const response = await this.client.post('/courier/serviceability', {
        origin: pickupPincode,
        destination: deliveryPincode,
        payment_type: paymentMode === 'cod' ? 'cod' : 'prepaid',
        weight: weight || 0.5,
      }, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const isServiceable = raw?.status === true || raw?.serviceable === true || raw?.data?.serviceable === true;
      const estDays = Number(raw?.data?.etd || raw?.estimated_days || 3);

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
      const headers = await this._getAuthHeaders();
      const response = await this.client.post('/courier/rates', {
        origin: pickupPincode,
        destination: deliveryPincode,
        weight: weight || 0.5,
        length: dimensions?.length || 10,
        breadth: dimensions?.width || 10,
        height: dimensions?.height || 10,
        payment_type: paymentMode === 'cod' ? 'cod' : 'prepaid',
        cod_amount: codAmount || 0,
      }, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const codCharge = paymentMode === 'cod' ? (codAmount > 1000 ? Math.round(codAmount * 0.02) : 35) : 0;
      const basePrice = Number(raw?.data?.rate || raw?.rate || 65);

      const mappedRates = [
        {
          serviceType: 'surface',
          courierName: 'Xpressbees Surface',
          price: basePrice,
          estimatedDays: Number(raw?.data?.etd || 4),
          codCharge,
        },
        {
          serviceType: 'express',
          courierName: 'Xpressbees Air Express',
          price: Math.round(basePrice * 1.3),
          estimatedDays: Number(raw?.data?.etd || 4) > 2 ? Number(raw?.data?.etd || 4) - 1 : 2,
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
      const headers = await this._getAuthHeaders();
      const payload = {
        order_number: String(order.id || `ORD-${Date.now()}`),
        shipping_charges: 0,
        discount: 0,
        cod_charges: order.payment_mode === 'cod' ? (order.cod_amount || 0) : 0,
        payment_type: order.payment_mode === 'cod' ? 'cod' : 'prepaid',
        order_amount: order.declared_value || order.cod_amount || 500,
        package_details: {
          length: order.length || 10,
          breadth: order.width || 10,
          height: order.height || 10,
          weight: order.weight || 0.5,
        },
        consignee_details: {
          name: order.customer_name,
          address: order.delivery_address,
          pincode: order.delivery_pincode,
          city: order.city || 'City',
          state: order.state || 'State',
          mobile: order.customer_phone,
          email: order.customer_email || '',
        },
        pickup_details: {
          warehouse_name: pickupAddress?.name || 'Warehouse',
          address: pickupAddress?.address_line1 || '',
          pincode: pickupAddress?.pincode || '',
          mobile: pickupAddress?.phone || '',
        }
      };

      const response = await this.client.post('/shipments2', payload, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const awb = raw?.data?.awb_number || raw?.awb_number || raw?.data?.shipment_id;
      if (!awb) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', raw?.message || 'Failed to generate Xpressbees AWB', {}, 'AWB_GENERATION_FAILED'), raw);
      }

      return ProviderResponse.ok({
        awbNumber: String(awb),
        courierShipmentId: String(raw?.data?.shipment_id || awb),
        labelUrl: raw?.data?.label || raw?.label || null,
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
      const headers = await this._getAuthHeaders();
      const response = await this.client.post('/shipments2/cancel', {
        awb: awbNumber,
      }, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const cancelled = raw?.status === true || raw?.success === true;
      return ProviderResponse.ok({ cancelled }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async trackShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const headers = await this._getAuthHeaders();
      const response = await this.client.get(`/shipments2/track/${awbNumber}`, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const data = raw?.data || raw || {};
      const rawHistory = data.history || data.scans || [];
      const currentRawStatus = data.status || (rawHistory[0]?.status) || 'in_transit';
      const mappedStatus = mapStatus(currentRawStatus);

      const history = rawHistory.map(h => ({
        status: mapStatus(h.status || h.status_code),
        location: h.location || h.hub || 'Unknown',
        timestamp: h.timestamp || h.date || new Date().toISOString(),
        remark: h.message || h.remark || '',
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
      const headers = await this._getAuthHeaders();
      const response = await this.client.get(`/shipments2/label/${awbNumber}`, { headers });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const labelUrl = raw?.data?.label_url || raw?.label_url || raw?.data;
      if (!labelUrl) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing label_url in Xpressbees response');
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
      await this._getToken();
      const latencyMs = Date.now() - startTime;
      return ProviderResponse.ok({ healthy: true, latencyMs });
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const headers = await this._getAuthHeaders();
      const payload = {
        awb: awbNumber,
        action: action_type === 'mark_rto' ? 'RTO' : 'REATTEMPT',
        address: updated_address_line1 || undefined,
        phone: updated_phone || undefined,
        comments: notes || 'Delivery reattempt requested via Nanoshipy NDR',
      };
      logger.info(`[XpressbeesAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post('/ndr/action', payload, { headers });
      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.message || 'ok' });
    } catch (err) {
      logger.warn(`[XpressbeesAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = XpressbeesAdapter;
