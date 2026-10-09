'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./ecomExpressResponseMapper');
const logger = require('../../utils/logger');

class EcomExpressAdapter extends CourierProviderAdapter {
  constructor(credentials, config = {}) {
    super(credentials, config);

    const defaultSandboxUrl = 'https://clbeta.ecomexpress.in';
    const defaultLiveUrl = 'https://api.ecomexpress.in';

    const baseUrl = this.config.sandbox_mode
      ? (process.env.ECOMEXPRESS_SANDBOX_BASE_URL || defaultSandboxUrl)
      : (process.env.ECOMEXPRESS_LIVE_BASE_URL || defaultLiveUrl);

    this.client = createClient(baseUrl, this.config.timeout_ms || 8000);
    this.providerKey = 'ecomexpress';
  }

  _validateCredentials() {
    const creds = this.credentials || {};
    if (!creds.username || !creds.password) {
      return new ProviderError('AUTH_FAILED', 'Ecom Express credentials missing: require username and password');
    }
    return null;
  }

  _getAuthPayload() {
    return {
      username: this.credentials?.username || '',
      password: this.credentials?.password || '',
    };
  }

  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.reason || data.message || data.error || err.message;
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
      const payload = {
        ...this._getAuthPayload(),
        pincode: deliveryPincode,
      };
      const response = await this.client.post('/services/pincode/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const data = Array.isArray(raw) ? raw[0] : (raw?.data || raw || {});
      const isServiceable = data.active === 'Y' || data.serviceable === true || data.status === 'SUCCESS';
      const estDays = Number(data.transit_days || data.estimated_days || 3);

      return ProviderResponse.ok({
        serviceable: !!isServiceable,
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
        ...this._getAuthPayload(),
        origin: pickupPincode,
        destination: deliveryPincode,
        weight: weight || 0.5,
        payment_mode: paymentMode === 'cod' ? 'COD' : 'PPD',
        cod_amount: codAmount || 0,
      };
      const response = await this.client.post('/services/rate_calculator/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const codCharge = paymentMode === 'cod' ? (codAmount > 1000 ? Math.round(codAmount * 0.02) : 30) : 0;
      const basePrice = Number(raw?.rate || raw?.total_amount || 60);

      const mappedRates = [
        {
          serviceType: 'surface',
          courierName: 'Ecom Express Surface',
          price: basePrice,
          estimatedDays: Number(raw?.estimated_days || 4),
          codCharge,
        },
        {
          serviceType: 'express',
          courierName: 'Ecom Express Air',
          price: Math.round(basePrice * 1.25),
          estimatedDays: Number(raw?.estimated_days || 4) > 2 ? Number(raw?.estimated_days || 4) - 1 : 2,
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
        ...this._getAuthPayload(),
        AWB_DETAILS: [
          {
            ORDER_NUMBER: String(order.id || `ORD-${Date.now()}`),
            PRODUCT: order.payment_mode === 'cod' ? 'COD' : 'PPD',
            CONSIGNEE: order.customer_name,
            CONSIGNEE_ADDRESS1: order.delivery_address?.substring(0, 50) || '',
            CONSIGNEE_ADDRESS2: order.delivery_address?.substring(50, 100) || '',
            CONSIGNEE_MOBILE: order.customer_phone,
            PINCODE: order.delivery_pincode,
            ITEM_DESCRIPTION: 'General Merchandise',
            ACTUAL_WEIGHT: order.weight || 0.5,
            VOLUMETRIC_WEIGHT: order.volumetric_weight || 0.5,
            COLLECTABLE_VALUE: order.payment_mode === 'cod' ? (order.cod_amount || 0) : 0,
            DECLARED_VALUE: order.declared_value || order.cod_amount || 500,
            PICKUP_NAME: pickupAddress?.name || 'Warehouse',
            PICKUP_ADDRESS_LINE1: pickupAddress?.address_line1 || '',
            PICKUP_PINCODE: pickupAddress?.pincode || '',
            PICKUP_MOBILE: pickupAddress?.phone || '',
          }
        ]
      };

      const response = await this.client.post('/services/shipment/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const awbObj = Array.isArray(raw) ? raw[0] : (raw?.shipments?.[0] || raw);
      const awb = awbObj?.awb || awbObj?.airwaybill_number || awbObj?.AWB_NO;

      if (!awb) {
        return ProviderResponse.fail(new ProviderError('UNKNOWN', awbObj?.reason || 'Failed to generate Ecom Express AWB', {}, 'AWB_GENERATION_FAILED'), raw);
      }

      return ProviderResponse.ok({
        awbNumber: String(awb),
        courierShipmentId: String(awb),
        labelUrl: awbObj?.label_url || null,
        estimatedPickupDate: awbObj?.pickup_date || new Date().toISOString(),
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async cancelShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const payload = {
        ...this._getAuthPayload(),
        awbs: [awbNumber],
      };
      const response = await this.client.post('/apiv2/cancel_awb/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const result = Array.isArray(raw) ? raw[0] : raw;
      const cancelled = result?.success === true || result?.status === 'SUCCESS' || result?.cancelled === true;
      return ProviderResponse.ok({ cancelled: !!cancelled }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async trackShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const payload = {
        ...this._getAuthPayload(),
        awb: awbNumber,
      };
      const response = await this.client.post('/services/track_me/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const trackingData = Array.isArray(raw) ? raw[0] : (raw?.data || raw || {});
      const rawScans = trackingData.scans || trackingData.history || [];
      const currentRawStatus = trackingData.status || (rawScans[0]?.status) || 'in_transit';
      const mappedStatus = mapStatus(currentRawStatus);

      const history = rawScans.map(s => ({
        status: mapStatus(s.status || s.scan_type),
        location: s.location || s.city || 'Unknown',
        timestamp: s.timestamp || s.scan_time || new Date().toISOString(),
        remark: s.reason || s.remark || '',
      }));

      return ProviderResponse.ok({
        status: mappedStatus,
        currentLocation: trackingData.current_location || history[0]?.location || 'Unknown',
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
      const payload = {
        ...this._getAuthPayload(),
        awb: awbNumber,
      };
      const response = await this.client.post('/services/print_label/', payload);
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const labelUrl = raw?.label_url || raw?.url || raw?.data?.label_url;
      if (!labelUrl) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing label_url in Ecom Express response');
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
      await this.checkServiceability({ deliveryPincode: '110001' });
      const latencyMs = Date.now() - startTime;
      return ProviderResponse.ok({ healthy: true, latencyMs });
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const payload = {
        ...this._getAuthPayload(),
        awb: awbNumber,
        action: action_type === 'mark_rto' ? 'RTO' : 'RE-ATTEMPT',
        address: updated_address_line1 || undefined,
        phone: updated_phone || undefined,
        remarks: notes || 'Delivery reattempt requested via Nanoshipy NDR',
      };
      logger.info(`[EcomExpressAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post('/ndr/action/', payload);
      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.status || 'ok' });
    } catch (err) {
      logger.warn(`[EcomExpressAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = EcomExpressAdapter;
