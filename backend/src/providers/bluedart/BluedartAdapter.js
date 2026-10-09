'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./bluedartResponseMapper');
const logger = require('../../utils/logger');

class BluedartAdapter extends CourierProviderAdapter {
  constructor(credentials, config = {}) {
    super(credentials, config);

    const defaultSandboxUrl = 'https://apigateway-sandbox.bluedart.com';
    const defaultLiveUrl = 'https://apigateway.bluedart.com';

    const baseUrl = this.config.sandbox_mode
      ? (process.env.BLUEDART_SANDBOX_BASE_URL || defaultSandboxUrl)
      : (process.env.BLUEDART_LIVE_BASE_URL || defaultLiveUrl);

    this.client = createClient(baseUrl, this.config.timeout_ms || 8000);
    this.providerKey = 'bluedart';
  }

  _getAuthHeaders() {
    const creds = this.credentials || {};
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'JWTToken': creds.jwt_token || creds.api_key || '',
      'LicenceKey': creds.license_key || creds.licence_key || '',
      'LoginID': creds.login_id || '',
      'CustomerCode': creds.customer_code || '',
    };
  }

  _validateCredentials() {
    const creds = this.credentials || {};
    if (!creds.api_key && !creds.jwt_token && !creds.license_key && !creds.login_id) {
      return new ProviderError('AUTH_FAILED', 'Blue Dart credentials missing: require api_key/jwt_token or login_id and license_key');
    }
    return null;
  }

  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.error_message || data.message || data.ErrorMessage || err.message;
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
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const payload = {
        pPinCodeFrom: pickupPincode,
        pPinCodeTo: deliveryPincode,
        pProductCode: paymentMode === 'cod' ? 'E' : 'D',
        pSubProductCode: 'P',
        pActualWeight: weight || 0.5,
        customerCode: this.credentials.customer_code || '',
      };
      const response = await this.client.post('/in/transportation/finder/v1/servicedeliverydetails', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from Blue Dart serviceability');
      }

      // BlueDart returns response in raw.GetServicesforProductResult or direct json
      const result = raw.GetServicesforProductResult || raw.data || raw;
      const isServiceable = result.IsServiceable === true || result.serviceable === true || result.Status === 'SUCCESS' || (result.ErrorMessage === '' && !result.IsError);
      const estDays = Number(result.TransitDays || result.estimated_days || 3);

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
        pPinCodeFrom: pickupPincode,
        pPinCodeTo: deliveryPincode,
        pProductCode: paymentMode === 'cod' ? 'E' : 'D',
        pSubProductCode: 'P',
        pActualWeight: weight || 0.5,
        pDimension: `${dimensions?.length || 10}x${dimensions?.width || 10}x${dimensions?.height || 10}`,
        pDeclaredValue: codAmount || 500,
        customerCode: this.credentials.customer_code || '',
      };
      const response = await this.client.post('/in/transportation/pricing/v1/pricecalculation', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from Blue Dart rate calculation');
      }

      const result = raw.PriceCalculationResult || raw.data || raw;
      const totalAmount = Number(result.TotalAmount || result.price || result.FreightRate || 0);
      const codCharge = paymentMode === 'cod' ? Number(result.CodCharges || 40) : 0;

      const mappedRates = [
        {
          serviceType: 'express',
          courierName: 'Blue Dart Express',
          price: totalAmount > 0 ? totalAmount : 90,
          estimatedDays: Number(result.TransitDays || 2),
          codCharge,
        },
        {
          serviceType: 'surface',
          courierName: 'Blue Dart Surface',
          price: totalAmount > 0 ? Math.round(totalAmount * 0.85) : 75,
          estimatedDays: Number(result.TransitDays || 2) + 2,
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
        Request: {
          Consignee: {
            ConsigneeName: order.customer_name,
            ConsigneeAddress1: order.delivery_address?.substring(0, 45) || '',
            ConsigneeAddress2: order.delivery_address?.substring(45, 90) || '',
            ConsigneePincode: order.delivery_pincode,
            ConsigneeMobile: order.customer_phone,
            ConsigneeEmail: order.customer_email || '',
          },
          Shipper: {
            CustomerCode: this.credentials.customer_code || '',
            CustomerName: pickupAddress?.name || 'Warehouse',
            CustomerAddress1: pickupAddress?.address_line1 || '',
            CustomerPincode: pickupAddress?.pincode || '',
            CustomerMobile: pickupAddress?.phone || '',
          },
          Services: {
            AWBNo: '',
            ProductCode: order.payment_mode === 'cod' ? 'E' : 'D',
            SubProductCode: 'P',
            ActualWeight: order.weight || 0.5,
            CollectableAmount: order.payment_mode === 'cod' ? (order.cod_amount || 0) : 0,
            DeclaredValue: order.declared_value || order.cod_amount || 500,
            CreditReferenceNo: order.id || `ORD-${Date.now()}`,
          }
        }
      };
      const response = await this.client.post('/in/transportation/waybill/v1/generate', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing response from Blue Dart shipment generation');
      }

      const result = raw.GenerateWayBillResult || raw.data || raw;
      const awb = result.AWBNo || result.awb_number || result.WaybillNo;

      if (!awb) {
        const errorMsg = result.Status?.[0]?.StatusInformation || result.ErrorMessage || 'Failed to generate Blue Dart AWB';
        return ProviderResponse.fail(new ProviderError('UNKNOWN', errorMsg, {}, 'AWB_GENERATION_FAILED'), raw);
      }

      return ProviderResponse.ok({
        awbNumber: String(awb),
        courierShipmentId: String(awb),
        labelUrl: result.LabelUrl || result.label_url || null,
        estimatedPickupDate: result.PickupDate || new Date().toISOString(),
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
        Request: {
          AWBNo: awbNumber,
          CustomerCode: this.credentials.customer_code || '',
        }
      };
      const response = await this.client.post('/in/transportation/waybill/v1/cancel', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const result = raw?.CancelWaybillResult || raw?.data || raw || {};
      const cancelled = result.IsCancelled === true || result.cancelled === true || result.Status === 'SUCCESS';
      return ProviderResponse.ok({ cancelled: !!cancelled }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async trackShipment({ awbNumber }) {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.get(`/in/transportation/tracking/v1/track?awb=${awbNumber}`, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing tracking response from Blue Dart');
      }

      const result = raw.ShipmentData || raw.data || raw;
      const rawScans = result.Scans || result.scans || result.history || [];
      const currentRawStatus = result.Status || result.status || (rawScans.length > 0 ? rawScans[0].Scan : 'in_transit');
      const mappedStatus = mapStatus(currentRawStatus);

      const history = rawScans.map(s => ({
        status: mapStatus(s.Scan || s.status),
        location: s.ScannedLocation || s.location || 'Unknown',
        timestamp: s.ScanDate ? `${s.ScanDate}T${s.ScanTime || '00:00:00'}` : new Date().toISOString(),
        remark: s.ScanDetail || s.remark || '',
      }));

      return ProviderResponse.ok({
        status: mappedStatus,
        currentLocation: result.CurrentLocation || (rawScans[0]?.ScannedLocation) || 'Unknown',
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
      const response = await this.client.get(`/in/transportation/waybill/v1/print?awb=${awbNumber}`, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);
      const labelUrl = raw?.label_url || raw?.LabelUrl || raw?.data?.label_url;
      if (!labelUrl) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Missing label_url in Blue Dart response');
      }
      return ProviderResponse.ok({ labelUrl }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async healthCheck() {
    const authErr = this._validateCredentials();
    if (authErr) return ProviderResponse.fail(authErr);

    const apiCall = async () => {
      const response = await this.client.get('/in/transportation/health/v1', {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const startTime = Date.now();
      const raw = await executeWithRetry(apiCall);
      const latencyMs = Date.now() - startTime;
      return ProviderResponse.ok({ healthy: true, latencyMs }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const payload = {
        awb: awbNumber,
        action: action_type === 'mark_rto' ? 'RTO' : 'RE-DELIVER',
        updatedAddress: updated_address_line1 || '',
        updatedPhone: updated_phone || '',
        remarks: notes || 'Delivery reattempt requested via Nanoshipy NDR',
      };
      logger.info(`[BluedartAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post('/in/transportation/ndr/v1/action', payload, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.status || 'ok' });
    } catch (err) {
      logger.warn(`[BluedartAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = BluedartAdapter;
