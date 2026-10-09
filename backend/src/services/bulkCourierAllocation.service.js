'use strict';

const { Op } = require('sequelize');
const {
  Order,
  PickupAddress,
  CourierProvider,
  Shipment,
  ShipmentRateQuote,
  PincodeMaster,
  Tenant,
} = require('../models');
const courierRoutingService = require('./courierRouting.service');
const pricingService = require('./pricing.service');
const shipmentService = require('./shipment.service');
const zoneResolver = require('./zoneResolver');
const stCourierDistrictRateRepo = require('../repositories/stCourierDistrictRate.repository');
const carrierMarginConfigRepo = require('../repositories/carrierMarginConfig.repository');
const codMarkupConfigRepo = require('../repositories/codMarkupConfig.repository');
const { calculateBillableWeight } = require('../utils/weight.util');
const { BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class BulkCourierAllocationService {
  /**
   * Bulk allocates couriers and dispatches shipments for selected orders.
   *
   * Routing Policy:
   * - Intra-Tamil Nadu (both origin & destination in TN, destination serviceable) -> ST Courier
   *   using destination district-wise rate cards and automated physical AWB assignment.
   * - Interstate / Rest of India -> Shipway Multi-Carrier Network
   *   using Shipway's courier allocation rules and carrier priorities.
   *
   * @param {Array<string>} orderIds - Array of Order UUIDs
   * @param {string} tenantId - Current seller/tenant ID
   * @param {string} userId - ID of the user performing the action
   * @param {object} [req=null] - Express request object
   * @returns {Promise<object>} Summary of allocation results
   */
  async bulkAllocateCouriers(orderIds, tenantId, userId, req = null) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestError('order_ids must be a non-empty array of order IDs.');
    }

    if (orderIds.length > 100) {
      throw new BadRequestError('Cannot process more than 100 orders in a single bulk allocation batch.');
    }

    // 1. Fetch active providers for stcourier and shipway
    const stProvider = await CourierProvider.findOne({
      where: { provider_key: 'stcourier', is_active: true },
    });
    const shipwayProvider = await CourierProvider.findOne({
      where: { provider_key: 'shipway', is_active: true },
    });

    // 2. Fetch default pickup address for tenant (fallback if order has none attached)
    const defaultPickup = await PickupAddress.findOne({
      where: { tenant_id: tenantId, is_default: true, is_active: true },
    }) || await PickupAddress.findOne({
      where: { tenant_id: tenantId, is_active: true },
      order: [['created_at', 'ASC']],
    });

    // 3. Load COD markup rules once for the batch
    let codRule = null;
    try {
      codRule = await codMarkupConfigRepo.getCurrent();
    } catch (_) {}

    // 4. Fetch orders belonging to tenant
    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: orderIds },
        tenant_id: tenantId,
      },
      include: [
        { model: PickupAddress, as: 'pickupAddress' },
      ],
    });

    const successful = [];
    const failed = [];
    const skipped = [];
    let stCourierCount = 0;
    let shipwayCount = 0;

    const orderMap = new Map();
    orders.forEach((o) => orderMap.set(o.id, o));

    // 5. Process each requested order ID (preserving input sequence)
    for (const orderId of orderIds) {
      const order = orderMap.get(orderId);

      if (!order) {
        failed.push({
          order_id: orderId,
          order_reference: 'N/A',
          reason: 'Order not found or does not belong to your account',
        });
        continue;
      }

      const orderRef = order.order_reference || order.order_number || order.id;

      // Check if order is in a shippable status
      if (!['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status)) {
        skipped.push({
          order_id: order.id,
          order_reference: orderRef,
          reason: `Order is in status "${order.status}" and cannot be dispatched`,
        });
        continue;
      }

      // Check if an active shipment already exists
      const existingActiveShipment = await Shipment.findOne({
        where: {
          order_id: order.id,
          tenant_id: tenantId,
          status: { [Op.notIn]: ['cancelled', 'failed'] },
        },
      });

      if (existingActiveShipment && existingActiveShipment.awb_number) {
        skipped.push({
          order_id: order.id,
          order_reference: orderRef,
          awb_number: existingActiveShipment.awb_number,
          shipment_id: existingActiveShipment.id,
          courier_name: existingActiveShipment.courier_provider_id === stProvider?.id ? 'ST Courier' : 'Shipway',
          reason: `Already dispatched with AWB ${existingActiveShipment.awb_number}`,
        });
        continue;
      }

      // Ensure a valid pickup address is assigned
      let pickup = order.pickupAddress;
      if (!pickup && defaultPickup) {
        pickup = defaultPickup;
        await order.update({ pickup_address_id: defaultPickup.id }).catch(() => {});
      }

      if (!pickup) {
        failed.push({
          order_id: order.id,
          order_reference: orderRef,
          reason: 'No pickup warehouse address configured for this order',
        });
        continue;
      }

      const pickupPincode = pickup.pincode;
      const pickupState = pickup.state || '';
      const deliveryPincode = order.shipping_pincode;
      const deliveryState = order.shipping_state || '';

      // Determine routing allocation (Intra-TN -> ST Courier, Rest of India -> Shipway)
      let routing;
      try {
        routing = await courierRoutingService.determineAssignedCourier(
          deliveryPincode,
          deliveryState,
          pickupPincode,
          pickupState
        );
      } catch (routingErr) {
        failed.push({
          order_id: order.id,
          order_reference: orderRef,
          reason: `Routing evaluation error: ${routingErr.message}`,
        });
        continue;
      }

      const isIntraTnStCourier = routing.isLocal && routing.providerKey === 'stcourier';

      // =========================================================================
      // BRANCH 1: ST COURIER (Intra-Tamil Nadu with District-Wise Rate Rules)
      // =========================================================================
      if (isIntraTnStCourier) {
        if (!stProvider) {
          failed.push({
            order_id: order.id,
            order_reference: orderRef,
            reason: 'ST Courier provider is not active or configured on the platform',
          });
          continue;
        }

        try {
          // Resolve origin district from pickup pincode (ST Courier rates are based on origin branch district)
          let originDistrict = null;
          if (pickupPincode) {
            try {
              const pinRecord = await PincodeMaster.findOne({ where: { pincode: String(pickupPincode).trim() } });
              if (pinRecord && pinRecord.district) {
                originDistrict = pinRecord.district.trim();
              }
            } catch (_) {}
            if (!originDistrict) {
              try {
                const loc = await zoneResolver.getPincodeLocation(pickupPincode);
                if (loc && loc.district) originDistrict = loc.district.trim();
                else if (loc && loc.city) originDistrict = loc.city.trim();
              } catch (_) {}
            }
          }
          if (!originDistrict && pickup?.district) {
            originDistrict = pickup.district.trim();
          }
          if (!originDistrict && pickup?.city) {
            originDistrict = pickup.city.trim();
          }

          // Fallback to destination district if origin district not found
          let destDistrict = null;
          if (deliveryPincode) {
            try {
              const pinRecord = await PincodeMaster.findOne({ where: { pincode: String(deliveryPincode).trim() } });
              if (pinRecord && pinRecord.district) {
                destDistrict = pinRecord.district.trim();
              }
            } catch (_) {}
            if (!destDistrict) {
              try {
                const loc = await zoneResolver.getPincodeLocation(deliveryPincode);
                if (loc && loc.district) destDistrict = loc.district.trim();
                else if (loc && loc.city) destDistrict = loc.city.trim();
              } catch (_) {}
            }
          }
          if (!destDistrict && order.shipping_city) {
            destDistrict = order.shipping_city.trim();
          }

          // Fetch district rate card by origin district (fallback to destination district)
          const effectiveDistrict = originDistrict || destDistrict;
          let districtRate = null;
          if (effectiveDistrict) {
            districtRate = await stCourierDistrictRateRepo.findByDistrict(effectiveDistrict);
          }

          const isCod = order.payment_mode && String(order.payment_mode).toLowerCase() === 'cod';

          // Fallback if district name not found directly
          const first500g = districtRate
            ? parseFloat(isCod && districtRate.cod_first_500g_rate != null ? districtRate.cod_first_500g_rate : districtRate.first_500g_rate)
            : (isCod ? 50.00 : 30.00);
          const add500g = districtRate
            ? parseFloat(isCod && districtRate.cod_additional_500g_rate != null ? districtRate.cod_additional_500g_rate : districtRate.additional_500g_rate)
            : (isCod ? 20.00 : 15.00);
          const above10kg = districtRate
            ? parseFloat(isCod && districtRate.cod_above_10kg_per_kg_rate != null ? districtRate.cod_above_10kg_per_kg_rate : districtRate.above_10kg_per_kg_rate)
            : (isCod ? 35.00 : 25.00);

          const weightKg = Math.max(0.1, parseFloat(order.weight_kg) || 0.50);
          let freightCost = 0.00;

          if (weightKg <= 10.0) {
            const slabs = pricingService.calculateSlabs(weightKg, 0.50, 0.50);
            freightCost = first500g + (slabs.additionalUnits * add500g);
          } else {
            freightCost = Math.ceil(weightKg) * above10kg;
          }

          // COD fee calculation
          let codFee = 0.00;
          if (isCod) {
            const orderVal = parseFloat(order.cod_amount || order.order_value || 0);
            const flatCod = parseFloat(codRule?.flat_charge || 30.00);
            const pctCod = parseFloat(codRule?.percent_charge || 2.00);
            codFee = Math.round(Math.max(flatCod, orderVal * (pctCod / 100)) * 100) / 100;
          }

          // Platform margin / markup for tenant
          let markupPercent = 0.00;
          try {
            const zone = await zoneResolver.resolveZone(pickupPincode, deliveryPincode);
            const markupRule = await carrierMarginConfigRepo.getEffectiveMarkup({
              courierProviderId: stProvider.id,
              zone,
              sellerId: tenantId,
            });
            if (markupRule && markupRule.scope !== 'global') {
              markupPercent = parseFloat(markupRule.markup_percent || 0);
            }
          } catch (_) {}

          const sellFreight = Math.round((freightCost * (1 + markupPercent / 100)) * 100) / 100;
          const totalQuotedRate = Math.round((sellFreight + codFee) * 100) / 100;
          const serviceType = 'st_courier_surface';

          // Insert or update quote
          await ShipmentRateQuote.create({
            id: uuidv4(),
            order_id: order.id,
            courier_provider_id: stProvider.id,
            service_type: serviceType,
            price: sellFreight,
            cod_charge: codFee,
            estimated_days: 1,
            quoted_at: new Date(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
          });

          // Book shipment via shipmentService
          const shipment = await shipmentService.createShipment({
            order_id: order.id,
            courier_provider_id: stProvider.id,
            service_type: serviceType,
            quoted_rate: totalQuotedRate,
          }, tenantId, userId, req);

          stCourierCount++;
          successful.push({
            order_id: order.id,
            order_reference: orderRef,
            provider_key: 'stcourier',
            courier_name: 'ST Courier (Tamil Nadu Express)',
            service_type: 'st_courier_surface',
            district: destDistrict || 'Tamil Nadu',
            awb_number: shipment.awb_number,
            shipment_id: shipment.id,
            label_url: shipment.label_url,
            status: shipment.status,
          });
        } catch (stErr) {
          logger.error(`[BulkCourierAllocation] ST Courier booking failed for order ${orderRef}: ${stErr.message}`);
          failed.push({
            order_id: order.id,
            order_reference: orderRef,
            provider_key: 'stcourier',
            reason: stErr.message || 'ST Courier shipment creation failed',
          });
        }
        continue;
      }

      // =========================================================================
      // BRANCH 2: SHIPWAY (Interstate / Rest of India via Shipway Courier Rules)
      // =========================================================================
      if (!shipwayProvider) {
        failed.push({
          order_id: order.id,
          order_reference: orderRef,
          reason: 'Shipway provider is not active or configured on the platform',
        });
        continue;
      }

      // Pre-flight check: Shipway requires a linked warehouse / fulfillment code
      const warehouseId = pickup.shipway_location_id || pickup.warehouse_id;
      if (!warehouseId || String(warehouseId).trim() === '') {
        failed.push({
          order_id: order.id,
          order_reference: orderRef,
          provider_key: 'shipway',
          reason: `Pickup warehouse "${pickup.label || pickup.address_line1 || 'Default'}" is missing Shipway Location ID / Hub Code`,
        });
        continue;
      }

      try {
        // Resolve Shipway carrier and rate according to Shipway rules
        let selectedCarrierId = '80593'; // Default Xpressbees Surface
        let courierDisplayName = 'National Express Network';
        let quotedRate = parseFloat(order.shipping_charge) || 55.00;
        let codFee = 0.00;

        try {
          // Attempt to retrieve rate options from Shipway
          const tenantRates = await pricingService.getTenantRates(order.id, tenantId, userId);
          if (tenantRates && Array.isArray(tenantRates.rates) && tenantRates.rates.length > 0) {
            // Pick top recommended / cheapest carrier as per Shipway priority rules
            const topRate = tenantRates.rates.find((r) => r.is_allocated) || tenantRates.rates[0];
            selectedCarrierId = String(topRate.service_type || topRate.carrier_id || '80593');
            courierDisplayName = topRate.display_name || 'National Express Partner';
            const price = parseFloat(topRate.price || 55.00);
            codFee = parseFloat(topRate.cod_charge || 0.00);
            quotedRate = Math.round((price + codFee) * 100) / 100;
          }
        } catch (ratesErr) {
          logger.warn(`[BulkCourierAllocation] Rates query warning for order ${orderRef}: ${ratesErr.message}. Using default carrier rule.`);

          // Fallback quote generation
          const isCod = order.payment_mode && String(order.payment_mode).toLowerCase() === 'cod';
          if (isCod) {
            const orderVal = parseFloat(order.cod_amount || order.order_value || 0);
            codFee = Math.round(Math.max(40.00, orderVal * 0.025) * 100) / 100;
            quotedRate = Math.round((quotedRate + codFee) * 100) / 100;
          }

          await ShipmentRateQuote.create({
            id: uuidv4(),
            order_id: order.id,
            courier_provider_id: shipwayProvider.id,
            service_type: selectedCarrierId,
            price: quotedRate - codFee,
            cod_charge: codFee,
            estimated_days: 3,
            quoted_at: new Date(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
          });
        }

        // Book shipment via shipmentService
        const shipment = await shipmentService.createShipment({
          order_id: order.id,
          courier_provider_id: shipwayProvider.id,
          service_type: selectedCarrierId,
          quoted_rate: quotedRate,
        }, tenantId, userId, req);

        shipwayCount++;
        successful.push({
          order_id: order.id,
          order_reference: orderRef,
          provider_key: 'shipway',
          courier_name: courierDisplayName,
          service_type: selectedCarrierId,
          awb_number: shipment.awb_number,
          shipment_id: shipment.id,
          label_url: shipment.label_url,
          status: shipment.status,
        });
      } catch (shipwayErr) {
        logger.error(`[BulkCourierAllocation] Shipway booking failed for order ${orderRef}: ${shipwayErr.message}`);
        failed.push({
          order_id: order.id,
          order_reference: orderRef,
          provider_key: 'shipway',
          reason: shipwayErr.message || 'Shipway shipment creation failed',
        });
      }
    }

    return {
      total: orderIds.length,
      allocated_count: successful.length,
      failed_count: failed.length,
      skipped_count: skipped.length,
      breakdown: {
        st_courier: stCourierCount,
        shipway: shipwayCount,
      },
      successful,
      failed,
      skipped,
    };
  }
}

module.exports = new BulkCourierAllocationService();
