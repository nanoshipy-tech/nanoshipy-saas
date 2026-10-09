'use strict';

const db = require('../config/db.config');
const {
  Order,
  OrderItem,
  Shipment,
  CourierProvider,
  PickupAddress,
  PincodeMaster,
  StCourierAwbInventory,
  StCourierDistrictRate,
  Tenant,
  User,
} = require('../models');
const { getPincodeLocation } = require('./zoneResolver');
const courierRoutingService = require('./courierRouting.service');
const stCourierDistrictRateRepo = require('../repositories/stCourierDistrictRate.repository');
const shipmentService = require('./shipment.service');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { Op } = require('sequelize');

class CounterBookingService {
  /**
   * Calculate real-time counter rate and determine courier routing.
   */
  async calculateRate({ pickupPincode, deliveryPincode, weightKg = 0.5, consignmentType = 'non_document', tenantId }) {
    if (!deliveryPincode) {
      throw new BadRequestError('Delivery pincode is required');
    }

    const weight = Math.max(0.05, parseFloat(weightKg) || 0.5);
    const destPinStr = String(deliveryPincode).trim();
    const origPinStr = pickupPincode ? String(pickupPincode).trim() : '600001';

    // 1. Resolve Locations
    let origLoc = await getPincodeLocation(origPinStr);
    let destLoc = await getPincodeLocation(destPinStr);

    if (!origLoc) {
      origLoc = { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', pincode: origPinStr };
    }
    if (!destLoc) {
      destLoc = { city: 'Destination', district: 'Destination District', state: 'Tamil Nadu', pincode: destPinStr };
    }

    // 2. Determine assigned courier using our Tamil Nadu routing rules
    const routing = await courierRoutingService.determineAssignedCourier(
      destPinStr,
      destLoc.state,
      origPinStr,
      origLoc.state
    );

    let providerKey = routing.providerKey || 'stcourier';
    let courierName = routing.assignedCourierName;
    let isLocal = routing.isLocal;
    let zone = routing.zone;
    let estimatedDays = isLocal ? 1 : 3;

    let baseRate = 0;
    let retailPrice = 0;

    if (isLocal && providerKey === 'stcourier') {
      // Look up ST Courier district rate using origin district (booking office branch)
      const originDistrict = origLoc.district || origLoc.city;
      const destDistrict = destLoc.district || destLoc.city;
      const effectiveDistrict = originDistrict || destDistrict;
      let districtRate = null;
      try {
        districtRate = await stCourierDistrictRateRepo.findByDistrict(effectiveDistrict);
      } catch (_) {}

      const first500g = districtRate ? parseFloat(districtRate.first_500g_rate) : 40.0;
      const add500g = districtRate ? parseFloat(districtRate.additional_500g_rate) : 25.0;

      if (consignmentType === 'document' && weight <= 0.25) {
        baseRate = Math.max(30.0, first500g - 10.0);
      } else if (weight <= 0.5) {
        baseRate = first500g;
      } else if (weight <= 10.0) {
        const excess = weight - 0.5;
        const slabs = Math.ceil(excess / 0.5);
        baseRate = first500g + slabs * add500g;
      } else {
        const perKg = districtRate ? parseFloat(districtRate.above_10kg_per_kg_rate) : 35.0;
        baseRate = Math.ceil(weight) * perKg;
      }

      // Retail counter price (base rate + standard counter margin rounded to clean integer)
      retailPrice = Math.ceil(baseRate * 1.25);
    } else {
      // Interstate or Non-ST Serviceable TN -> Shipway
      providerKey = 'shipway';
      courierName = routing.assignedCourierName || 'National Express (Shipway)';
      isLocal = false;
      let selectedServiceType = '80622';

      try {
        const shippingRuleEvaluator = require('./shippingRuleEvaluator.service');
        const catalog = shippingRuleEvaluator.getAvailableCarrierCatalog().filter(c => c.provider_key !== 'stcourier');
        const availableCatalogRates = catalog.map(c => ({
          service_type: c.courier_key,
          carrierId: c.courier_key,
          courierName: c.name,
          display_name: c.name,
          price: 60.0,
        }));

        const ruleEval = await shippingRuleEvaluator.evaluateOptimalCourier({
          tenantId,
          pickupAddressId: null,
          weightKg: weight,
          isCod: false,
          paymentMode: 'prepaid',
          zone,
          deliveryPincode: destPinStr,
          availableRates: availableCatalogRates,
          isLocalTn: false,
        });

        if (ruleEval && ruleEval.allocatedRate) {
          courierName = ruleEval.allocatedRate.display_name || courierName;
          selectedServiceType = ruleEval.allocatedRate.service_type || selectedServiceType;
        }
      } catch (evalErr) {
        logger.warn(`[CounterBooking] Shipping rule evaluation notice: ${evalErr.message}`);
      }

      // National Express pricing baseline
      const baseSlab = consignmentType === 'document' && weight <= 0.5 ? 65.0 : 80.0;
      if (weight <= 0.5) {
        baseRate = baseSlab;
      } else {
        const excessUnits = Math.ceil((weight - 0.5) / 0.5);
        baseRate = baseSlab + excessUnits * 45.0;
      }
      retailPrice = Math.ceil(baseRate * 1.20);
    }

    const gstAmount = Math.round(retailPrice * 0.18 * 100) / 100;
    const finalTotal = Math.round(retailPrice + gstAmount);

    return {
      providerKey,
      courierName,
      serviceType: isLocal ? 'st_courier_surface' : selectedServiceType,
      isLocal,
      zone,
      consignmentType,
      estimatedDays,
      billableWeight: weight <= 0.5 ? 0.5 : Math.ceil(weight * 2) / 2,
      baseRate: Math.round(baseRate * 100) / 100,
      retailRate: retailPrice,
      gstAmount,
      totalCounterRate: finalTotal,
      origin: {
        city: origLoc.city,
        district: origLoc.district,
        state: origLoc.state,
        pincode: origPinStr,
      },
      destination: {
        city: destLoc.city,
        district: destLoc.district,
        state: destLoc.state,
        pincode: destPinStr,
      },
    };
  }

  /**
   * Book a counter walk-in order atomically: creates order + shipment + AWB allocation.
   */
  async bookCounterOrder(tenantId, data, userId) {
    const {
      pickup_address_id,
      sender_name,
      sender_phone,
      receiver_name,
      receiver_phone,
      shipping_address_line1,
      shipping_address_line2,
      shipping_pincode,
      shipping_city,
      shipping_state,
      consignment_type = 'non_document',
      weight_kg = 0.5,
      length_cm = 10,
      width_cm = 10,
      height_cm = 5,
      order_value = 100,
      counter_payment_method = 'cash',
      counter_amount_collected,
      counter_notes,
      manual_awb_number,
    } = data;

    if (!receiver_name || !receiver_phone || !shipping_pincode || !shipping_address_line1) {
      throw new BadRequestError('Receiver name, phone, delivery pincode, and address line are required.');
    }

    // 0. Resolve Effective User ID
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const tenantUser = await User.findOne({ where: { tenant_id: tenantId } });
      if (tenantUser) effectiveUserId = tenantUser.id;
      else {
        const anyUser = await User.findOne();
        if (anyUser) effectiveUserId = anyUser.id;
      }
    }

    // 1. Resolve Pickup Address (Booking Office Origin)
    let pickupAddress = null;
    if (pickup_address_id) {
      pickupAddress = await PickupAddress.findOne({ where: { id: pickup_address_id } });
    }
    if (!pickupAddress) {
      pickupAddress = await PickupAddress.findOne({
        where: { tenant_id: tenantId, is_active: true },
        order: [['is_default', 'DESC'], ['created_at', 'ASC']],
      });
    }
    if (!pickupAddress) {
      // Fallback to any active pickup address
      pickupAddress = await PickupAddress.findOne({ where: { is_active: true } });
    }
    if (!pickupAddress) {
      throw new BadRequestError('No active Booking Office pickup address configured. Please configure at least one pickup address.');
    }

    // 2. Resolve destination location
    const destPinStr = String(shipping_pincode).trim();
    let destLoc = await getPincodeLocation(destPinStr);
    const resolvedCity = shipping_city || (destLoc ? destLoc.city : 'Tamil Nadu');
    const resolvedState = shipping_state || (destLoc ? destLoc.state : 'Tamil Nadu');

    // 3. Rate & Routing Calculation
    const quote = await this.calculateRate({
      pickupPincode: pickupAddress.pincode,
      deliveryPincode: destPinStr,
      weightKg: weight_kg,
      consignmentType: consignment_type,
      tenantId,
    });

    const finalAmountCollected = parseFloat(counter_amount_collected) || quote.totalCounterRate;

    // 4. Resolve Courier Provider
    const providerKey = quote.providerKey || 'stcourier';
    let courierProvider = await CourierProvider.findOne({
      where: { provider_key: providerKey, is_active: true },
    });
    if (!courierProvider) {
      courierProvider = await CourierProvider.findOne({ where: { is_active: true } });
    }
    if (!courierProvider) {
      throw new NotFoundError(`No active courier provider found for ${providerKey}`);
    }

    // Generate unique order reference
    const timestampStr = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderRef = `BKG-${providerKey === 'stcourier' ? 'ST' : 'EXP'}-${timestampStr}-${randomSuffix}`;

    const isToPay = counter_payment_method === 'to_pay';

    // 5. Create Order & Item
    const order = await Order.create({
      tenant_id: tenantId,
      order_reference: orderRef,
      pickup_address_id: pickupAddress.id,
      customer_name: receiver_name.trim(),
      customer_phone: receiver_phone.trim(),
      customer_email: data.receiver_email || null,
      shipping_address_line1: shipping_address_line1.trim(),
      shipping_address_line2: shipping_address_line2 ? shipping_address_line2.trim() : null,
      shipping_city: resolvedCity,
      shipping_state: resolvedState,
      shipping_pincode: destPinStr,
      shipping_country: 'India',
      order_value: parseFloat(order_value) || 100.0,
      payment_mode: isToPay ? 'cod' : 'prepaid',
      cod_amount: isToPay ? finalAmountCollected : 0.0,
      weight_kg: parseFloat(weight_kg) || 0.5,
      length_cm: parseFloat(length_cm) || 10.0,
      width_cm: parseFloat(width_cm) || 10.0,
      height_cm: parseFloat(height_cm) || 5.0,
      status: 'ready_to_ship',
      source: 'manual',
      booking_type: 'booking_office',
      sender_name: sender_name ? sender_name.trim() : (pickupAddress.contact_name || 'Booking Office'),
      sender_phone: sender_phone ? sender_phone.trim() : (pickupAddress.contact_phone || ''),
      consignment_type,
      counter_payment_method,
      counter_amount_collected: finalAmountCollected,
      counter_notes: counter_notes || null,
      created_by: effectiveUserId,
    });

    await OrderItem.create({
      order_id: order.id,
      product_name: consignment_type === 'document' ? 'Documents / Letters' : 'Parcel Consignment',
      sku: 'BKG-COUNTER',
      quantity: 1,
      unit_price: finalAmountCollected,
      total_price: finalAmountCollected,
    });

    // 6. Manual AWB handling if provided for ST Courier
    if (manual_awb_number && providerKey === 'stcourier') {
      try {
        const cleanAwb = String(manual_awb_number).trim();
        const existingAwb = await StCourierAwbInventory.findOne({
          where: { awb_number: cleanAwb, status: 'available' },
        });
        if (existingAwb) {
          existingAwb.status = 'assigned';
          existingAwb.assigned_at = new Date();
          await existingAwb.save();
        }
      } catch (awbErr) {
        logger.warn(`Failed to pre-assign manual AWB ${manual_awb_number}: ${awbErr.message}`);
      }
    }

    // 7. Instant Shipment & AWB Creation
    let shipment = null;
    try {
      shipment = await shipmentService.createShipment(
        {
          order_id: order.id,
          courier_provider_id: courierProvider.id,
          service_type: quote.serviceType || 'express',
          tenantId,
          userId: effectiveUserId,
        },
        tenantId,
        effectiveUserId
      );
    } catch (shipErr) {
      logger.error(`Counter booking shipment creation error for order ${order.id}: ${shipErr.message}`);
      throw shipErr;
    }

    // Reload order and shipment with associations
    const freshOrder = await Order.findByPk(order.id, {
      include: ['pickupAddress', 'items'],
    });

    const freshShipment = await Shipment.findOne({
      where: { order_id: order.id },
      include: ['provider'],
    });

    const receiptData = this.buildReceiptData(freshOrder, freshShipment, pickupAddress);

    return {
      success: true,
      order: freshOrder,
      shipment: freshShipment,
      awb_number: freshShipment ? freshShipment.awb_number : null,
      courier_name: courierProvider.name || quote.courierName,
      provider_key: providerKey,
      label_url: freshShipment ? freshShipment.label_url : null,
      receiptData,
    };
  }

  /**
   * Structure printable thermal POS receipt data for counter customers.
   */
  buildReceiptData(order, shipment, pickupAddress) {
    const bookingOfficeName = pickupAddress ? (pickupAddress.label || pickupAddress.city || 'Express Booking Counter') : 'NanoShipy Booking Office';
    const awb = shipment ? (shipment.awb_number || 'PENDING') : 'PENDING';
    const bookedAt = order ? order.created_at : new Date();

    return {
      receiptNumber: order.order_reference,
      bookingOffice: {
        name: bookingOfficeName,
        phone: pickupAddress ? pickupAddress.contact_phone : '',
        address: pickupAddress ? `${pickupAddress.address_line1 || ''}, ${pickupAddress.city || ''} - ${pickupAddress.pincode || ''}` : '',
        district: pickupAddress ? pickupAddress.district : '',
      },
      awbNumber: awb,
      courierName: require('./receiptPdf.service').getCleanCarrierName(shipment, order) || (awb.startsWith('ST') ? 'ST Courier' : 'Express Courier Partner'),
      bookedAt: new Date(bookedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      sender: {
        name: order.sender_name || pickupAddress?.contact_name || 'Walk-in Sender',
        phone: order.sender_phone || pickupAddress?.contact_phone || '',
        city: pickupAddress?.city || 'Origin',
      },
      receiver: {
        name: order.customer_name,
        phone: order.customer_phone,
        address: `${order.shipping_address_line1}${order.shipping_address_line2 ? ', ' + order.shipping_address_line2 : ''}`,
        city: order.shipping_city,
        state: order.shipping_state,
        pincode: order.shipping_pincode,
      },
      consignment: {
        type: order.consignment_type === 'document' ? 'Document / Letter' : 'Parcel / Non-Doc',
        weight: `${order.weight_kg} kg`,
        declaredValue: `₹${parseFloat(order.order_value || 0).toFixed(2)}`,
      },
      billing: {
        paymentMethod: (order.counter_payment_method || 'cash').toUpperCase(),
        amountPaid: `₹${parseFloat(order.counter_amount_collected || 0).toFixed(2)}`,
        isToPay: order.counter_payment_method === 'to_pay',
      },
      trackingUrl: `https://nanoshipy.com/track?awb=${awb}`,
    };
  }

  /**
   * Daily Counter Cash Collection & Parcel Dispatch Summary.
   */
  async getDailyCounterSummary(tenantId, dateStr = null) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause = {
      booking_type: 'booking_office',
      created_at: {
        [Op.between]: [startOfDay, endOfDay],
      },
    };

    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: Shipment.unscoped(),
          as: 'shipments',
          attributes: ['id', 'awb_number', 'service_type', 'status', 'label_url', 'provider_raw_response'],
          include: ['provider'],
        },
        'pickupAddress',
      ],
      order: [['created_at', 'DESC']],
    });

    let totalCash = 0;
    let totalUpi = 0;
    let totalToPay = 0;
    let stCourierCount = 0;
    let shipwayCount = 0;

    const recentBookings = orders.map((ord) => {
      const amt = parseFloat(ord.counter_amount_collected) || 0;
      if (ord.counter_payment_method === 'cash') totalCash += amt;
      else if (ord.counter_payment_method === 'upi') totalUpi += amt;
      else if (ord.counter_payment_method === 'to_pay') totalToPay += amt;

      const firstShipment = ord.shipments && ord.shipments.length > 0 ? ord.shipments[0] : null;
      const provKey = firstShipment?.provider?.provider_key;
      if (provKey === 'stcourier') stCourierCount++;
      else shipwayCount++;

      return {
        id: ord.id,
        orderReference: ord.order_reference,
        awbNumber: firstShipment ? firstShipment.awb_number : 'Pending',
        courier: require('./receiptPdf.service').getCleanCarrierName(firstShipment, ord) || (provKey === 'stcourier' ? 'ST Courier' : 'Express Courier Partner'),
        receiverName: ord.customer_name,
        receiverCity: ord.shipping_city,
        receiverPincode: ord.shipping_pincode,
        consignmentType: ord.consignment_type,
        weightKg: ord.weight_kg,
        paymentMethod: ord.counter_payment_method,
        amount: amt,
        bookedAt: ord.created_at,
        labelUrl: firstShipment ? firstShipment.label_url : null,
      };
    });

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalBookings: orders.length,
      totalRevenue: totalCash + totalUpi + totalToPay,
      totalCashCollected: totalCash,
      totalUpiCollected: totalUpi,
      totalToPay: totalToPay,
      stCourierCount,
      shipwayCount,
      recentBookings: recentBookings.slice(0, 20),
    };
  }

  /**
   * Get all booking offices (pickup addresses) across the platform.
   */
  async getBookingOffices({ is_active = 'all', tenant_id = null, search = '' } = {}) {
    const whereClause = {};

    if (is_active === 'true' || is_active === true) {
      whereClause.is_active = true;
    } else if (is_active === 'false' || is_active === false) {
      whereClause.is_active = false;
    }

    if (tenant_id) {
      whereClause.tenant_id = tenant_id;
    }

    const dialect = db.getDialect();
    const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      whereClause[Op.or] = [
        { label: { [likeOp]: `%${cleanSearch}%` } },
        { contact_name: { [likeOp]: `%${cleanSearch}%` } },
        { city: { [likeOp]: `%${cleanSearch}%` } },
        { pincode: { [likeOp]: `%${cleanSearch}%` } },
      ];
    }

    const offices = await PickupAddress.findAll({
      where: whereClause,
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'company_name', 'support_email', 'support_phone'],
        },
      ],
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    const officeIds = offices.map((o) => o.id);
    let countsByOffice = {};
    if (officeIds.length > 0) {
      const orderCounts = await Order.findAll({
        attributes: [
          'pickup_address_id',
          [db.fn('COUNT', db.col('id')), 'booking_count'],
        ],
        where: {
          pickup_address_id: { [Op.in]: officeIds },
        },
        group: ['pickup_address_id'],
        raw: true,
      });

      orderCounts.forEach((oc) => {
        countsByOffice[oc.pickup_address_id] = parseInt(oc.booking_count, 10) || 0;
      });
    }

    return offices.map((o) => ({
      id: o.id,
      tenantId: o.tenant_id,
      merchantName: o.tenant?.company_name || 'Standard Account',
      label: o.label || 'Origin Hub',
      contactName: o.contact_name,
      contactPhone: o.contact_phone,
      addressLine1: o.address_line1,
      city: o.city,
      state: o.state,
      pincode: o.pincode,
      isActive: Boolean(o.is_active),
      isDefault: Boolean(o.is_default),
      totalBookings: countsByOffice[o.id] || 0,
      createdAt: o.created_at,
    }));
  }

  /**
   * Toggle booking office activation status (enable / disable).
   */
  async toggleOfficeStatus(officeId, isActive) {
    const office = await PickupAddress.findByPk(officeId, {
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'company_name'] }],
    });

    if (!office) {
      throw new NotFoundError('Booking office not found');
    }

    const newStatus = typeof isActive === 'boolean' ? isActive : !office.is_active;
    await office.update({ is_active: newStatus });

    logger.info(`[BookingOffice] Office "${office.label || office.city}" (${office.id}) status changed to: ${newStatus}`);

    return {
      id: office.id,
      label: office.label,
      city: office.city,
      isActive: newStatus,
      message: `Booking office "${office.label || office.city}" has been ${newStatus ? 'enabled' : 'disabled'}.`,
    };
  }

  /**
   * Get orders booked from different booking offices with complete value details.
   */
  async getCounterOrders({
    tenant_id = null,
    pickup_address_id = null,
    payment_method = null,
    status = null,
    search = '',
    limit = 50,
    offset = 0,
    sort = 'created_at:desc',
  } = {}) {
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const whereClause = {
      booking_type: 'booking_office',
    };

    if (tenant_id) whereClause.tenant_id = tenant_id;
    if (pickup_address_id) whereClause.pickup_address_id = pickup_address_id;
    if (payment_method) whereClause.counter_payment_method = payment_method;
    if (status) whereClause.status = status;

    const dialect = db.getDialect();
    const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      whereClause[Op.or] = [
        { order_reference: { [likeOp]: `%${cleanSearch}%` } },
        { customer_name: { [likeOp]: `%${cleanSearch}%` } },
        { customer_phone: { [likeOp]: `%${cleanSearch}%` } },
        { shipping_city: { [likeOp]: `%${cleanSearch}%` } },
        { shipping_pincode: { [likeOp]: `%${cleanSearch}%` } },
      ];
    }

    const include = [
      {
        model: PickupAddress,
        as: 'pickupAddress',
        attributes: ['id', 'label', 'contact_name', 'contact_phone', 'address_line1', 'city', 'state', 'pincode', 'is_active', 'is_default'],
      },
      {
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'company_name', 'support_email', 'support_phone'],
      },
      {
        model: Shipment.unscoped(),
        as: 'shipments',
        attributes: ['id', 'awb_number', 'service_type', 'status', 'label_url', 'provider_raw_response'],
        include: [{ model: CourierProvider, as: 'provider', attributes: ['id', 'display_name', 'provider_key'] }],
      },
      {
        model: OrderItem,
        as: 'items',
      },
    ];

    const [sortField, sortOrder] = (sort || 'created_at:desc').split(':');
    const order = [[sortField || 'created_at', (sortOrder || 'DESC').toUpperCase()]];

    const { rows, count } = await Order.findAndCountAll({
      where: whereClause,
      include,
      distinct: true,
      limit: parsedLimit,
      offset,
      order,
    });

    // Compute aggregate value stats across all matching orders
    const allMatchingOrders = await Order.findAll({
      where: whereClause,
      attributes: ['id', 'order_value', 'counter_amount_collected', 'counter_payment_method', 'status'],
      include: [
        {
          model: Shipment,
          as: 'shipments',
          attributes: ['id', 'courier_provider_id'],
          include: [{ model: CourierProvider, as: 'provider', attributes: ['provider_key'] }],
        },
      ],
    });

    let totalGoodsValue = 0;
    let totalFreightRevenue = 0;
    let totalCash = 0;
    let totalUpi = 0;
    let totalToPay = 0;
    let stCount = 0;
    let shipwayCount = 0;

    allMatchingOrders.forEach((o) => {
      const itemVal = parseFloat(o.order_value) || 0;
      const freightVal = parseFloat(o.counter_amount_collected) || 0;
      totalGoodsValue += itemVal;
      totalFreightRevenue += freightVal;

      if (o.counter_payment_method === 'cash') totalCash += freightVal;
      else if (o.counter_payment_method === 'upi') totalUpi += freightVal;
      else if (o.counter_payment_method === 'to_pay') totalToPay += freightVal;

      const firstShip = o.shipments && o.shipments[0];
      const provKey = firstShip?.provider?.provider_key;
      if (provKey === 'stcourier') stCount++;
      else shipwayCount++;
    });

    const orders = rows.map((ord) => {
      const firstShipment = ord.shipments && ord.shipments.length > 0 ? ord.shipments[0] : null;
      const provKey = firstShipment?.provider?.provider_key;
      const awb = firstShipment?.awb_number || 'Pending';
      const courierName = require('./receiptPdf.service').getCleanCarrierName(firstShipment, ord) || (awb.startsWith('ST') || provKey === 'stcourier' ? 'ST Courier' : 'Express Courier Partner');

      return {
        id: ord.id,
        orderReference: ord.order_reference,
        tenantId: ord.tenant_id,
        merchantName: ord.tenant?.company_name || 'Standard Account',
        bookingOffice: ord.pickupAddress
          ? {
              id: ord.pickupAddress.id,
              label: ord.pickupAddress.label || ord.pickupAddress.city,
              city: ord.pickupAddress.city,
              state: ord.pickupAddress.state,
              pincode: ord.pickupAddress.pincode,
              isActive: ord.pickupAddress.is_active,
            }
          : null,
        consignee: {
          name: ord.customer_name,
          phone: ord.customer_phone,
          city: ord.shipping_city,
          state: ord.shipping_state,
          pincode: ord.shipping_pincode,
          address: ord.shipping_address_line1,
        },
        courier: {
          name: courierName,
          awbNumber: awb,
          provider_key: provKey,
          status: firstShipment?.status || ord.status,
          labelUrl: firstShipment?.label_url || null,
        },
        valueDetails: {
          declaredGoodsValue: parseFloat(ord.order_value) || 0,
          freightAmountCollected: parseFloat(ord.counter_amount_collected) || 0,
          paymentMethod: ord.counter_payment_method || 'cash',
        },
        specs: {
          weightKg: parseFloat(ord.weight_kg) || 0.5,
          consignmentType: ord.consignment_type || 'non_document',
          notes: ord.counter_notes,
        },
        status: ord.status,
        bookedAt: ord.created_at,
      };
    });

    return {
      orders,
      pagination: {
        totalCount: count,
        limit: parsedLimit,
        offset,
        page: Math.floor(offset / parsedLimit) + 1,
        totalPages: Math.ceil(count / parsedLimit),
      },
      summaryValues: {
        totalOrders: count,
        totalGoodsValue,
        totalFreightRevenue,
        totalCashCollected: totalCash,
        totalUpiCollected: totalUpi,
        totalToPay: totalToPay,
        stCourierCount: stCount,
        shipwayCount,
      },
    };
  }
}

module.exports = new CounterBookingService();
