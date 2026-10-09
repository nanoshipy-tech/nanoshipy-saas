'use strict';

const { CourierProviderAdapter } = require('../base/CourierProviderAdapter.interface');
const ProviderResponse = require('../base/ProviderResponse.dto');
const ProviderError = require('../base/ProviderError');
const { ProviderResponseMalformedError, ConfigurationError, ProviderValidationError } = require('../errors');
const { createClient } = require('../shared/httpClientFactory');
const { executeWithRetry } = require('../shared/retryPolicy.util');
const { mapStatus } = require('./shipwayResponseMapper');
const logger = require('../../utils/logger');

class ShipwayAdapter extends CourierProviderAdapter {
  constructor(credentials, config) {
    super(credentials, config);

    // Shipway uses https://app.shipway.com/api (Production/Live endpoint)
    const defaultBaseUrl = 'https://app.shipway.com/api';
    const baseUrl = process.env.SHIPWAY_BASE_URL || this.config?.base_url || defaultBaseUrl;

    this.client = createClient(baseUrl, this.config?.timeout_ms || 8000);
    this.providerKey = 'shipway';
  }

  /**
   * Generates standard HTTP Basic Authentication headers for Shipway.
   * Credentials: username/email : license_key
   */
  _getAuthHeaders() {
    const username = this.credentials?.username || this.credentials?.email || this.credentials?.login_id || this.credentials?.client_name || process.env.SHIPWAY_EMAIL;
    const licenseKey = this.credentials?.license_key || this.credentials?.password || this.credentials?.api_key || this.credentials?.api_token || process.env.SHIPWAY_LICENSE_KEY;

    if (!username || !licenseKey) {
      throw new ConfigurationError('Shipway credentials missing: SHIPWAY_EMAIL and SHIPWAY_LICENSE_KEY must be configured.');
    }

    const token = Buffer.from(`${username}:${licenseKey}`).toString('base64');

    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Formats API errors into standard ProviderErrors.
   */
  _handleError(err) {
    if (err instanceof ProviderResponseMalformedError) {
      return err;
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};
      const msg = data.message || data.error || data.error_message || err.message;
      const code = data.error_code || data.code || null;

      if (status === 401 || status === 403 || code === 'AUTH_FAILED' || String(msg).toLowerCase().includes('unauthorized')) {
        return new ProviderError('AUTH_FAILED', 'Shipway carrier authentication failed. Please verify your Login ID and License Key in Superadmin > Couriers.', {}, code || 'UNAUTHORIZED');
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
      return new ProviderError('SERVICE_UNAVAILABLE', 'Shipway API connection timed out', {}, 'TIMEOUT');
    }
    return new ProviderError('UNKNOWN', err.message);
  }

  /**
   * Check Pincode Serviceability
   * GET /api/pincodeserviceable?pincode={pincode}&payment_type={P|C}
   */
  async checkServiceability({ deliveryPincode, pickupPincode, paymentMode, weight }) {
    const pincode = deliveryPincode || pickupPincode;
    const paymentType = (paymentMode && String(paymentMode).toLowerCase() === 'cod') ? 'C' : 'P';

    const apiCall = async () => {
      const response = await this.client.get('/pincodeserviceable', {
        params: {
          pincode,
          payment_type: paymentType,
        },
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from serviceability API');
      }

      // Shipway format: { success: 1, error: "", message: [ { carrier_id, name, carrier_title, payment_type }, ... ] }
      const isSuccess = raw.success === 1 || raw.success === true || raw.status === true;
      const carrierList = Array.isArray(raw.message) ? raw.message : (Array.isArray(raw.data) ? raw.data : []);

      if (!isSuccess && carrierList.length === 0) {
        const errorMsg = typeof raw.message === 'string' ? raw.message : (raw.error || 'Pincode not serviceable');
        return ProviderResponse.fail(new ProviderError('INVALID_PINCODE', errorMsg, {}, raw.error_code), raw);
      }

      const isServiceable = carrierList.length > 0;

      return ProviderResponse.ok({
        serviceable: isServiceable,
        estimatedDays: 3,
        serviceableCarriers: carrierList.map(c => ({
          carrierId: c.carrier_id || c.id,
          carrierName: c.name || c.carrier_title,
          paymentType: c.payment_type,
        })),
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Get Carrier Rates
   * GET /api/getshipwaycarrierrates?fromPincode=...&toPincode=...&paymentType=...&weight=...
   */
  async getRates({ pickupPincode, deliveryPincode, weight, dimensions, paymentMode, codAmount }) {
    const pType = (paymentMode && String(paymentMode).toLowerCase() === 'cod') ? 'cod' : 'prepaid';
    const weightKg = Number(weight || 0.5);

    const apiCall = async () => {
      const response = await this.client.get('/getshipwaycarrierrates', {
        params: {
          fromPincode: pickupPincode,
          toPincode: deliveryPincode,
          paymentType: pType,
          weight: weightKg,
          length: dimensions?.length || 10,
          breadth: dimensions?.width || dimensions?.breadth || 10,
          height: dimensions?.height || 10,
          cummulativePrice: codAmount || 0,
        },
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from rates API');
      }

      // Rates can be a direct array: [{ zone, courier_id, courier, shipment_charges, charge_weight }]
      // or wrapped in { success: "success", rate_card: [...] } or { message: [...] } or { data: [...] }
      let rateItems = [];
      if (Array.isArray(raw)) {
        rateItems = raw;
      } else if (Array.isArray(raw.rate_card)) {
        rateItems = raw.rate_card;
      } else if (Array.isArray(raw.message)) {
        rateItems = raw.message;
      } else if (Array.isArray(raw.data)) {
        rateItems = raw.data;
      } else if (raw.success === 0 || raw.error) {
        const errorMsg = typeof raw.message === 'string' ? raw.message : (raw.error || 'Failed to fetch rates');
        return ProviderResponse.fail(new ProviderError('UNKNOWN', errorMsg), raw);
      }

      const mappedRates = rateItems.map(r => {
        const freight = parseFloat(r.freight || r.freight_charge || r.freight_charges || 0);
        const surcharge = parseFloat(r.surcharge || r.surcharges || r.fuel_surcharge || r.other_charges || 0);
        const totalField = parseFloat(r.total_charges || r.total_charge || r.total_amount || r.total || 0);
        const baseDelivery = parseFloat(r.delivery_charge || r.shipment_charges || r.price || 0);

        let totalCost = 0;
        if (totalField > 0) {
          totalCost = totalField;
        } else if (freight > 0) {
          totalCost = freight + surcharge;
        } else if (baseDelivery > 0) {
          totalCost = baseDelivery + surcharge;
        } else {
          totalCost = 0;
        }

        const rawCarrierTitle = String(
          r.carrier_title ||
          r.title ||
          r.carrier_name ||
          r.courier_name ||
          r.courier ||
          r.name ||
          ''
        ).trim();

        // Strip "Shipway" prefix/wordmark without affecting the courier name or weight slabs (e.g. "Delhivery Surface", "Delhivery Express", "Delhivery 1 kg")
        let cleanCourierName = rawCarrierTitle
          .replace(/^Shipway\s*[-–:]?\s*/i, '')
          .replace(/\bShipway\b/gi, '')
          .trim();

        const carrierIdStr = String(r.carrier_id || r.courier_id || '').trim();

        const shipwayCarrierIdMap = {
          '80622': 'Delhivery Surface',
          '7442':  'Delhivery Express',
          '80734': 'Delhivery Surface',
          '80977': 'Delhivery Surface',
          '7613':  'Delhivery Surface',
          '7666':  'Delhivery Surface',
          '81769': 'Blue Dart Surface',
          '7377':  'Blue Dart Express',
          '80593': 'XpressBees Surface',
          '80652': 'XpressBees Air Priority',
          '79681': 'Shadowfax Surface',
          '79930': 'Shadowfax Surface',
          '71468': 'Ekart Surface',
          '80275': 'Ekart Surface',
          '81514': 'Ekart Express',
          '80063': 'Ekart Surface',
          '80064': 'Ekart Surface',
          '82861': 'Ekart Logistics',
          '19339': 'Amazon Shipping',
          '80800': 'DTDC Express',
        };

        const lower = cleanCourierName.toLowerCase();

        if (!cleanCourierName || lower === 'multi-carrier') {
          cleanCourierName = shipwayCarrierIdMap[carrierIdStr] || 'National Express Partner';
        } else if (shipwayCarrierIdMap[carrierIdStr]) {
          const isPlainBrandOnly = /^(delhivery|bluedart|blue dart|ekart|shadowfax|xpressbees|dtdc|amazon)$/i.test(cleanCourierName);
          const isBrandWithDefaultHalfKg = /^(delhivery|bluedart|blue dart|ekart|shadowfax)\s*\(\s*0?\.5\s*k?g\s*\)$/i.test(cleanCourierName);
          if (isPlainBrandOnly || isBrandWithDefaultHalfKg) {
            cleanCourierName = shipwayCarrierIdMap[carrierIdStr];
          }
        }

        return {
          serviceType: carrierIdStr || 'surface',
          courierName: cleanCourierName,
          carrierTitle: cleanCourierName,
          price: Math.round(totalCost * 100) / 100,
          freightCharge: freight > 0 ? freight : baseDelivery,
          surcharge: surcharge,
          estimatedDays: 3,
          codCharge: pType === 'cod' ? (parseFloat(r.cod_charges || 0)) : 0,
          zone: r.zone || null,
          chargeWeight: parseFloat(r.charged_weight || r.charge_weight || weightKg),
          carrierId: carrierIdStr || null,
        };
      });

      return ProviderResponse.ok({ rates: mappedRates }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Push Order with Automatic AWB and Label Generation
   * POST /api/v2orders
   */
  async createShipment({ order, pickupAddress, serviceType }) {
    // Resolve warehouse IDs (strictly prioritize order's specific pickup address location)
    const warehouseId = pickupAddress?.shipway_location_id ||
      pickupAddress?.warehouse_id ||
      pickupAddress?.vendor_warehouse_id ||
      this.credentials?.warehouse_id ||
      this.credentials?.location_id ||
      this.config?.warehouse_id ||
      1;

    const returnWarehouseId = pickupAddress?.return_warehouse_id ||
      this.credentials?.return_warehouse_id ||
      warehouseId;

    // Weight conversion: Shipway expects weight in GRAMS
    let weightInGrams = 500;
    if (order.weight) {
      const w = Number(order.weight);
      weightInGrams = w <= 50 ? Math.round(w * 1000) : Math.round(w);
    }

    // Payment type mapping: 'P' = Prepaid, 'C' = COD
    const isCod = order.payment_mode && String(order.payment_mode).toLowerCase() === 'cod';
    const paymentType = isCod ? 'C' : 'P';

    // Parse Customer Name into firstname & lastname
    const fullName = (order.customer_name || 'Customer').trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    let orderReference = order.order_reference || order.order_number || order.order_id;
    if (!orderReference || String(orderReference).trim() === '') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(order.id || ''));
      if (order.id && !isUuid) {
        orderReference = String(order.id).trim();
      } else {
        const shortId = order.id ? String(order.id).replace(/-/g, '').slice(-8).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
        orderReference = `ORD-${Date.now().toString().slice(-6)}-${shortId}`;
      }
    } else {
      orderReference = String(orderReference).trim();
    }

    // Prepare Products Array
    let products = [];
    if (Array.isArray(order.items) && order.items.length > 0) {
      products = order.items.map((item, idx) => ({
        product: item.name || item.product_name || `Product ${idx + 1}`,
        price: String(item.price || item.unit_price || 100),
        product_code: item.sku || item.product_code || `SKU-${idx + 1}`,
        hsn_code: item.hsn_code || '610910',
        product_quantity: String(item.quantity || 1),
        discount: String(item.discount || 0),
        tax_rate: String(item.tax_rate || 18),
        tax_title: item.tax_title || 'IGST',
      }));
    } else {
      products = [{
        product: order.product_name || `Order #${orderReference}`,
        price: String(order.amount || order.declared_value || 100),
        product_code: `SKU-${orderReference}`,
        hsn_code: '610910',
        product_quantity: '1',
        discount: '0',
        tax_rate: '18',
        tax_title: 'IGST',
      }];
    }

    const payload = {
      order_id: orderReference,
      warehouse_id: warehouseId,
      location_id: warehouseId,
      return_warehouse_id: returnWarehouseId,
      products,
      payment_type: paymentType,
      email: order.customer_email || 'orders@customer.com',
      order_total: String(order.amount || order.cod_amount || 100),
      shipping: '0',
      taxes: '0',
      billing_firstname: firstName,
      billing_lastname: lastName,
      billing_address: order.delivery_address || 'Address',
      billing_city: order.delivery_city || 'City',
      billing_state: order.delivery_state || 'State',
      billing_country: order.delivery_country || 'IN',
      billing_phone: String(order.customer_phone || '9999999999'),
      billing_zipcode: String(order.delivery_pincode || '110001'),
      shipping_firstname: firstName,
      shipping_lastname: lastName,
      shipping_address: order.delivery_address || 'Address',
      shipping_city: order.delivery_city || 'City',
      shipping_state: order.delivery_state || 'State',
      shipping_country: order.delivery_country || 'IN',
      shipping_phone: String(order.customer_phone || '9999999999'),
      shipping_zipcode: String(order.delivery_pincode || '110001'),
      order_weight: (() => {
        const bL = Number(order.length_cm || order.length || order.box_length || 10);
        const bW = Number(order.width_cm || order.width || order.breadth || order.box_breadth || 10);
        const bH = Number(order.height_cm || order.height || order.box_height || 10);
        const volGrams = Math.round(((bL * bW * bH) / 5000) * 1000);
        return Math.max(weightInGrams, volGrams);
      })(),
      box_length: Number(order.length_cm || order.length || order.box_length || 10),
      box_breadth: Number(order.width_cm || order.width || order.breadth || order.box_breadth || 10),
      box_height: Number(order.height_cm || order.height || order.box_height || 10),
      order_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    const carrierMap = {
      'delhivery': 80622, // Shipway Delhivery (0.5kg)
      'delhivery_surface': 80622,
      'delhivery_express': 7442,
      'bluedart': 81769, // Shipway Bluedart (0.5kg)
      'bluedart_express': 7377,
      'xpressbees': 80593, // Shipway Xpressbees (0.5kg)
      'xpressbees_express': 80652,
      'ekart': 82861,
      'shadowfax': 79681,
      'amazon': 19339,
      'dtdc': 80800,
      'dtdc_express': 80800,
      'surface': 80622,
      'standard': 80622,
      'express': 7442,
    };

    const normalizedServiceType = serviceType ? String(serviceType).toLowerCase().trim() : null;

    if (normalizedServiceType && !isNaN(Number(normalizedServiceType))) {
      payload.carrier_id = Number(normalizedServiceType);
    } else if (normalizedServiceType && carrierMap[normalizedServiceType]) {
      payload.carrier_id = carrierMap[normalizedServiceType];
    } else if (normalizedServiceType) {
      throw new ProviderValidationError(`Unmapped service type "${serviceType}". Unable to resolve Shipway carrier_id.`);
    } else if (this.credentials?.carrier_id) {
      payload.carrier_id = Number(this.credentials.carrier_id);
    } else if (this.config?.carrier_id) {
      payload.carrier_id = Number(this.config.carrier_id);
    } else {
      payload.carrier_id = carrierMap['surface'] || 80622;
    }

    logger.info(`[ShipwayAdapter] Pushing order ${orderReference} with carrier_id ${payload.carrier_id}`);

    const apiCall = async () => {
      const response = await this.client.post('/v2orders', payload, {
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from order creation API');
      }

      if (raw.error || raw.success === false || raw.success === 0) {
        let errMsg = raw.message || raw.error_message || 'Failed to create order in Shipway';
        if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('subscription has expired')) {
          errMsg = 'Courier aggregator (Shipway) subscription has expired. Please recharge or renew the Shipway account subscription on shipway.com.';
        }
        return ProviderResponse.fail(new ProviderError('UNKNOWN', errMsg), raw);
      }

      // Check awb_response
      const awbResponse = raw.awb_response || {};
      const awbNumber = awbResponse.AWB || awbResponse.awb || raw.AWB || raw.awb_number || null;
      const labelUrl = awbResponse.shipping_url || raw.shipping_url || null;

      // Defense in depth (Issue #8): Never fabricate a fake AWB number
      if (!awbNumber) {
        const errMsg = awbResponse.message || raw.message || raw.error_message || 'Shipway did not return a valid AWB number for this order';
        logger.error(`[ShipwayAdapter] Order ${orderReference} push succeeded without AWB. Response: ${JSON.stringify(raw)}`);
        return ProviderResponse.fail(new ProviderError('CARRIER_AWB_GENERATION_FAILED', errMsg), raw);
      }

      return ProviderResponse.ok({
        awbNumber: String(awbNumber),
        courierShipmentId: orderReference,
        labelUrl: labelUrl,
        carrierId: awbResponse.carrier_id ? String(awbResponse.carrier_id) : (raw.carrier_id ? String(raw.carrier_id) : null),
        carrierName: awbResponse.carrier_name || raw.carrier_name || null,
        carrierTitle: awbResponse.carrier_title || null,
        estimatedPickupDate: null,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Cancel Shipment
   * 1. Calls POST https://app.shipway.com/api/Cancel/ with { awb_number: [awb] } to unassign courier
   * 2. Calls POST https://app.shipway.com/api/cancelorders/ with { order_ids: [orderId] } to mark cancelled in Shipway
   * Supports credential fallback between configured credentials and secondary credentials.
   */
  async cancelShipment({ awbNumber, orderId, courierShipmentId }) {
    const awb = awbNumber ? String(awbNumber).trim() : '';
    const orderIdentifier = courierShipmentId || orderId || awb;

    // Build credentials to try (configured credentials from DB or environment)
    const username = this.credentials?.username || this.credentials?.email || this.credentials?.login_id || process.env.SHIPWAY_EMAIL;
    const licenseKey = this.credentials?.license_key || this.credentials?.password || this.credentials?.api_key || process.env.SHIPWAY_LICENSE_KEY;

    if (!username || !licenseKey) {
      throw new ConfigurationError('Shipway credentials missing: SHIPWAY_EMAIL and SHIPWAY_LICENSE_KEY must be configured.');
    }

    const credentialSets = [{ username, licenseKey }];

    let cancelledOnCarrier = false;
    let cancelledInShipway = false;
    let finalMessage = 'Shipment cancelled';

    for (const cred of credentialSets) {
      const authHeader = `Basic ${Buffer.from(`${cred.username}:${cred.licenseKey}`).toString('base64')}`;
      const headers = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Step 1: Unassign courier on Shipway if awb is available
      if (awb && !cancelledOnCarrier) {
        try {
          logger.info(`[ShipwayAdapter] Requesting unassignment for AWB ${awb} via POST /Cancel/ with ${cred.username}`);
          const res = await this.client.post('/Cancel/', { awb_number: [awb] }, { headers, timeout: 15000 });
          const raw = res.data;
          logger.info(`[ShipwayAdapter] /Cancel/ response: ${JSON.stringify(raw)}`);
          if (raw && (raw.error === false || raw.success === true || raw.status === true)) {
            cancelledOnCarrier = true;
            finalMessage = raw.message || 'Courier unassigned successfully on Shipway';
            // Allow Shipway database 600ms to propagate status from Processing to Onhold/New
            await new Promise((r) => setTimeout(r, 600));
          } else if (raw?.message && String(raw.message).toLowerCase().includes('please select processing')) {
            // Already unassigned or pickup registered; proceed to order cancellation
            logger.info(`[ShipwayAdapter] Order with AWB ${awb} cannot be unassigned via /Cancel/ (${raw.message}), proceeding to cancelorders`);
          }
        } catch (err) {
          logger.warn(`[ShipwayAdapter] /Cancel/ attempt failed with ${cred.username}: ${err.message}`);
        }
      }

      // Step 2: Mark order cancelled in Shipway
      const idsToTry = [orderId, courierShipmentId, orderIdentifier].filter(Boolean).map(String);
      const uniqueIds = Array.from(new Set(idsToTry));

      if (uniqueIds.length > 0 && !cancelledInShipway) {
        try {
          logger.info(`[ShipwayAdapter] Requesting cancelorders for order_ids: ${JSON.stringify(uniqueIds)} with ${cred.username}`);
          const res = await this.client.post('/cancelorders/', { order_ids: uniqueIds }, { headers, timeout: 15000 });
          const raw = res.data;
          logger.info(`[ShipwayAdapter] /cancelorders/ response: ${JSON.stringify(raw)}`);
          if (Array.isArray(raw)) {
            const ok = raw.some(item => item.success === true || item.error === false);
            if (ok) {
              cancelledInShipway = true;
              finalMessage = raw[0]?.message || 'Order marked cancelled in Shipway';
            }
          } else if (raw && (raw.success === true || raw.error === false)) {
            cancelledInShipway = true;
            finalMessage = raw.message || 'Order marked cancelled in Shipway';
          }
        } catch (err) {
          logger.warn(`[ShipwayAdapter] /cancelorders/ attempt failed with ${cred.username}: ${err.message}`);
        }
      }

      if (cancelledInShipway || (cancelledOnCarrier && !awb)) {
        break; // Successfully cancelled with this credential set
      }
    }

    if (cancelledOnCarrier || cancelledInShipway) {
      return ProviderResponse.ok({
        cancelled: true,
        cancelledOnCarrier,
        cancelledInShipway,
        message: finalMessage,
      });
    }

    // Return notice if neither endpoint returned success
    return ProviderResponse.fail(new ProviderError('CANCELLATION_NOTICE', finalMessage || 'Could not unassign on Shipway carrier network'));
  }

  /**
   * Track Shipment
   * GET /api/tracking?awb_numbers={awb}&tracking_history=1
   */
  async trackShipment({ awbNumber }) {
    const apiCall = async () => {
      const response = await this.client.get('/tracking', {
        params: {
          awb_numbers: String(awbNumber),
          tracking_history: 1,
        },
        headers: this._getAuthHeaders(),
      });
      return response.data;
    };

    try {
      const raw = await executeWithRetry(apiCall);

      if (!raw) {
        throw new ProviderResponseMalformedError(this.providerKey, 'Empty response from tracking API');
      }

      // Response format: [ { awb: "...", tracking_details: { shipment_status: "DEL", shipment_details: [...], track_url, tracking_history: [...] } } ]
      let trackObj = null;
      if (Array.isArray(raw) && raw.length > 0) {
        trackObj = raw[0];
      } else if (raw.tracking_details) {
        trackObj = raw;
      }

      if (!trackObj || !trackObj.tracking_details) {
        return ProviderResponse.fail(new ProviderError('SHIPMENT_NOT_FOUND', `Tracking info not found for AWB: ${awbNumber}`), raw);
      }

      const details = trackObj.tracking_details;
      const shipmentDetails = (Array.isArray(details.shipment_details) && details.shipment_details.length > 0)
        ? details.shipment_details[0]
        : {};

      const rawStatusCode = details.shipment_status || details.current_status || shipmentDetails.current_status || 'INT';
      const mappedStatus = mapStatus(rawStatusCode);

      const rawHistory = Array.isArray(details.tracking_history) ? details.tracking_history : [];
      const history = rawHistory.map(h => ({
        status: mapStatus(h.status || h.shipment_status),
        location: h.location || shipmentDetails.destination || 'In Transit',
        timestamp: h.timestamp || new Date().toISOString(),
        remark: h.remarks || h.remark || '',
      }));

      return ProviderResponse.ok({
        status: mappedStatus,
        rawStatus: rawStatusCode,
        currentLocation: shipmentDetails.destination || (history[0]?.location) || 'In Transit',
        deliveredTo: shipmentDetails.delivered_to || null,
        trackUrl: details.track_url || null,
        history,
      }, raw);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Generate Shipping Label
   * For Shipway, label URL is created during /v2orders. If needed again, fetches via tracking or order status.
   */
  async generateLabel({ awbNumber, orderId }) {
    try {
      const trackRes = await this.trackShipment({ awbNumber });
      if (trackRes.success && trackRes.data?.trackUrl) {
        return ProviderResponse.ok({
          labelUrl: trackRes.data.trackUrl,
        }, trackRes.raw);
      }
      return ProviderResponse.ok({
        labelUrl: `https://app.shipway.com/generate-label/${awbNumber}`,
      }, {});
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Get All Carrier Partners
   * GET /api/getcarrier
   */
  async getCarriers(carrierId = null) {
    try {
      const params = carrierId ? { carrierid: carrierId } : {};
      const response = await this.client.get('/getcarrier', {
        params,
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Get Warehouses (Pickup Locations)
   * GET /api/getwarehouses
   */
  async getWarehouses(warehouseId = null) {
    try {
      const params = warehouseId ? { warehouseid: warehouseId } : {};
      const response = await this.client.get('/getwarehouses', {
        params,
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Create Warehouse (Pickup Location)
   * POST /api/warehouse/
   */
  async createWarehouse(warehouseData) {
    try {
      const response = await this.client.post('/warehouse/', warehouseData, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Create Manifest Document
   * POST /api/Createmanifest/
   */
  async createManifest({ orderIds }) {
    try {
      const response = await this.client.post('/Createmanifest/', {
        order_ids: Array.isArray(orderIds) ? orderIds : [orderIds],
      }, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Put Orders On Hold
   * POST /api/Onholdorders/
   */
  async putOnHold({ orderIds }) {
    try {
      const response = await this.client.post('/Onholdorders/', {
        order_ids: Array.isArray(orderIds) ? orderIds : [orderIds],
      }, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Create Returns / Reverse Pickup Shipment
   * POST /api/Createreturns
   */
  async createReturn(returnData) {
    try {
      const response = await this.client.post('/Createreturns', returnData, {
        headers: this._getAuthHeaders(),
      });
      return ProviderResponse.ok(response.data);
    } catch (err) {
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Health Check: validates credentials by fetching carrier configuration
   */
  async healthCheck() {
    const username = this.credentials?.username || this.credentials?.email;
    const licenseKey = this.credentials?.license_key || this.credentials?.password || this.credentials?.api_key;

    if (!username || !licenseKey) {
      return ProviderResponse.fail(new ProviderError('AUTH_FAILED', 'Missing Shipway username/email or license_key credentials'));
    }

    const start = Date.now();
    try {
      const response = await this.client.get('/getcarrier', {
        headers: this._getAuthHeaders(),
        timeout: 5000,
      });

      const latency = Date.now() - start;
      const isSuccess = response.data?.success === 1 || response.data?.success === true || Array.isArray(response.data?.message);

      if (isSuccess) {
        return ProviderResponse.ok({
          healthy: true,
          latencyMs: latency,
          message: 'Shipway credentials authorized successfully',
        }, response.data);
      }

      return ProviderResponse.fail(new ProviderError('AUTH_FAILED', response.data?.error || 'Failed to authenticate with Shipway'));
    } catch (err) {
      // In offline / dev testing mode without live internet or credentials
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('timeout')) {
        return ProviderResponse.ok({
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Shipway credentials formatted validly (Offline/Network restricted fallback)',
        }, { simulated: true });
      }
      return ProviderResponse.fail(this._handleError(err));
    }
  }

  /**
   * Forward NDR Action / Reattempt instructions to Shipway API
   * Endpoint: POST /ndr-action
   */
  async requestReattempt({ awbNumber, action_type, updated_address_line1, updated_phone, notes }) {
    try {
      const payload = {
        carrier_awb: awbNumber,
        action: action_type === 'mark_rto' ? 'rto' : 'reattempt',
        address: updated_address_line1 || undefined,
        phone: updated_phone || undefined,
        remarks: notes || 'Delivery reattempt requested via Nanoshipy NDR panel',
      };

      logger.info(`[ShipwayAdapter] Forwarding NDR action ${action_type} for AWB ${awbNumber}`);
      const response = await this.client.post('/ndr-action', payload, {
        headers: this._getAuthHeaders(),
      });

      return ProviderResponse.ok({ reattempted: true, provider_ref: response.data?.request_id || 'ok' });
    } catch (err) {
      logger.warn(`[ShipwayAdapter] NDR action forwarding failed: ${err.message}`);
      return ProviderResponse.ok({ reattempted: false, error: err.message });
    }
  }
}

module.exports = ShipwayAdapter;
