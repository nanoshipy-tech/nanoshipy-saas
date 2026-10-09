'use strict';

const { Op } = require('sequelize');
const { sequelize, Shipment, TrackingEvent, ShipmentStatusHistory, CourierProvider, Order, Tenant, PickupAddress } = require('../models');
const shipmentStatusService = require('./shipmentStatus.service');
const ndrDetectionQueue = require('../queues/ndrDetection.queue');
const logger = require('../utils/logger');

const ACTIVE_TRANSIT_STATUSES = ['awb_generated', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery'];
const STUCK_THRESHOLD_HOURS = 72;

/**
 * Ingest an array of normalized tracking events for a shipment.
 * Deduplicates via the unique index on (shipment_id, raw_status, event_timestamp).
 * Syncs the shipment's status to the most recent event if it has changed.
 *
 * @param {string} shipmentId
 * @param {Array<{status, raw_status, location, remark, event_timestamp}>} events - normalized events
 * @param {'webhook'|'poll'|'manual'} source
 * @param {object} [transaction] - optional Sequelize transaction
 */
async function ingestTrackingEvents(shipmentId, events, source, transaction = null) {
  if (!events || events.length === 0) return;

  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());

  try {
    // Sort events oldest-first so status history is chronological
    const sorted = [...events].sort(
      (a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp),
    );

    const createdEventIds = [];

    for (const ev of sorted) {
      try {
        const trackingEvent = await TrackingEvent.create(
          {
            shipment_id: shipmentId,
            status: ev.status,
            raw_status: ev.raw_status,
            location: ev.location || null,
            remark: ev.remark || null,
            event_timestamp: new Date(ev.event_timestamp),
            source,
          },
          {
            transaction: txn,
            // On duplicate unique key (shipment_id, raw_status, event_timestamp) → skip
            ignoreDuplicates: true,
          },
        );
        if (trackingEvent && trackingEvent.id) {
          createdEventIds.push(trackingEvent.id);
        }
      } catch (err) {
        // Unique constraint violation → duplicate, safe to skip
        if (err.name !== 'SequelizeUniqueConstraintError') {
          throw err;
        }
      }
    }

    // Sync shipment status to the latest event
    const latestEvent = sorted[sorted.length - 1];
    const shipment = await Shipment.findByPk(shipmentId, { transaction: txn });
    if (!shipment) {
      logger.warn(`[Tracking] Shipment ${shipmentId} not found when syncing status`);
      if (ownTxn) await txn.commit();
      return;
    }

    if (latestEvent.status !== shipment.status) {
      try {
        shipmentStatusService.validateTransition(shipment.status, latestEvent.status);
        const oldStatus = shipment.status;
        await shipment.update({ status: latestEvent.status }, { transaction: txn });
        
        // Sync parent Order status atomically
        const parentOrder = await Order.findByPk(shipment.order_id, { transaction: txn });
        if (parentOrder) {
          let newOrderStatus = parentOrder.status;
          if (['picked_up', 'in_transit', 'out_for_delivery'].includes(latestEvent.status)) newOrderStatus = 'processing';
          else if (['delivered'].includes(latestEvent.status)) newOrderStatus = 'fulfilled';
          else if (['rto_delivered', 'reverse_delivered'].includes(latestEvent.status)) newOrderStatus = 'returned';
          else if (['failed', 'cancelled'].includes(latestEvent.status)) newOrderStatus = 'failed';
          await parentOrder.update({ status: newOrderStatus }, { transaction: txn });
        }

        await shipmentStatusService.logHistory(
          shipmentId,
          oldStatus,
          latestEvent.status,
          source === 'webhook' ? 'provider_webhook' : 'system',
          `Updated via ${source} — ${latestEvent.raw_status}`,
          txn,
        );

        // Emit tracking.status_changed (Module 14 Hook)
        const eventBus = require('../events/eventBus');
        eventBus.emit('tracking.status_changed', {
          tenant_id: shipment.tenant_id,
          awb_number: shipment.awb_number,
          tracking_status: latestEvent.status,
          status: latestEvent.status,
          location: latestEvent.location || 'Hub Scan',
          remarks: latestEvent.remarks || '',
        });
      } catch (transitionErr) {
        logger.error(`[Tracking][INVALID_TRANSITION_ALERT] Invalid status transition rejected for shipment ${shipmentId} (AWB: ${shipment.awb_number}) from ${shipment.status} to ${latestEvent.status}: ${transitionErr.message}`, {
          shipment_id: shipmentId,
          old_status: shipment.status,
          attempted_status: latestEvent.status,
          raw_status: latestEvent.raw_status,
          source
        });

        const eventBus = require('../events/eventBus');
        eventBus.emit('tracking.transition_rejected', {
          shipment_id: shipmentId,
          awb_number: shipment.awb_number,
          old_status: shipment.status,
          attempted_status: latestEvent.status,
          raw_status: latestEvent.raw_status,
          error: transitionErr.message
        });

        const auditService = require('./audit.service');
        await auditService.log({
          action: 'invalid_shipment_transition_blocked',
          tenant_id: shipment.tenant_id,
          entity_type: 'shipment',
          entity_id: shipmentId,
          metadata: {
            old_status: shipment.status,
            rejected_status: latestEvent.status,
            raw_status: latestEvent.raw_status,
            error: transitionErr.message
          }
        }).catch(() => {});
      }
    }

    if (ownTxn) {
      await txn.commit();
      
      // Enqueue NDR detection jobs asynchronously after transaction commit
      for (const eventId of createdEventIds) {
        try {
          if (process.env.USE_MOCK_REDIS !== 'true') {
            await ndrDetectionQueue.add(`ndr-detect-${eventId}`, { trackingEventId: eventId });
          }
        } catch (queueErr) {
          logger.error(`[Tracking] Failed to enqueue NDR detection check for event ${eventId}:`, { error: queueErr.message });
        }
      }
    }
  } catch (err) {
    if (ownTxn) await txn.rollback();
    throw err;
  }
}

/**
 * Return the full ordered tracking timeline for a shipment (tenant-scoped).
 * @param {string} shipmentId
 * @param {string} tenantId
 */
async function getTrackingTimeline(shipmentId, tenantId) {
  const shipment = await Shipment.findOne({
    where: { id: shipmentId, tenant_id: tenantId },
    attributes: ['id', 'status', 'is_delayed_flag', 'awb_number'],
    include: [
      {
        model: TrackingEvent,
        as: 'trackingEvents',
        attributes: ['id', 'status', 'raw_status', 'location', 'remark', 'event_timestamp', 'source', 'ingested_at'],
        order: [['event_timestamp', 'DESC']],
        separate: true,
      },
    ],
  });

  if (!shipment) return null;

  return {
    shipment_id: shipment.id,
    awb_number: shipment.awb_number,
    current_status: shipment.status,
    is_delayed: shipment.is_delayed_flag,
    events: shipment.trackingEvents || [],
  };
}

function sanitizeRemark(remark) {
  if (!remark || typeof remark !== 'string') return remark;
  return remark
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***')
    .replace(/(?:\+?91|0)?[6-9]\d{9}/g, (match) => match.slice(0, 2) + '******' + match.slice(-2));
}

function maskName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.split(' ').map(part => {
    if (part.length <= 1) return part;
    return part[0] + '*'.repeat(Math.min(part.length - 1, 5));
  }).join(' ');
}

const { resolveCleanCarrierLogo: resolveBrandedLogo } = require('../utils/courierBranding.util');

function resolveCleanCarrierLogo(carrierName) {
  return resolveBrandedLogo(carrierName);
}

/**
 * Public tracking — returns timeline without PII.
 * Looks up by AWB number, shipment ID, or order number.
 * @param {string} query
 */
async function getPublicTracking(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim();

  // Validate if clean query is a valid UUID before querying UUID primary key
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  const whereConditions = [{ awb_number: clean }];
  if (isUuid) {
    whereConditions.push({ id: clean });
  }

  let shipment = await Shipment.findOne({
    where: {
      [Op.or]: whereConditions,
    },
    include: [
      {
        model: TrackingEvent,
        as: 'trackingEvents',
        attributes: ['id', 'status', 'raw_status', 'location', 'remark', 'event_timestamp', 'source'],
        order: [['event_timestamp', 'DESC']],
        separate: true,
      },
      {
        model: CourierProvider,
        as: 'provider',
        attributes: ['id', 'provider_key', 'display_name', 'logo_url', 'credentials_encrypted', 'config'],
      },
      {
        model: Order,
        as: 'order',
        attributes: [
          'id', 'order_reference', 'customer_name',
          'shipping_city', 'shipping_state',
          'sender_city', 'sender_state', 'is_walkin'
        ],
        include: [
          {
            model: PickupAddress,
            as: 'pickupAddress',
            attributes: ['city', 'state'],
            required: false,
          },
        ],
      },
      {
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'company_name', 'subdomain'],
      },
    ],
  });

  if (!shipment) {
    // Try finding by order_reference
    const order = await Order.findOne({
      where: { order_reference: clean },
      include: [
        {
          model: Shipment,
          as: 'shipments',
          include: [
            {
              model: TrackingEvent,
              as: 'trackingEvents',
              attributes: ['id', 'status', 'raw_status', 'location', 'remark', 'event_timestamp', 'source'],
              order: [['event_timestamp', 'DESC']],
              separate: true,
            },
            {
              model: CourierProvider,
              as: 'provider',
              attributes: ['id', 'provider_key', 'display_name', 'logo_url', 'credentials_encrypted', 'config'],
            },
            {
              model: Tenant,
              as: 'tenant',
              attributes: ['id', 'company_name', 'subdomain'],
            },
          ],
        },
      ],
    });

    if (order && order.shipments && order.shipments.length > 0) {
      shipment = order.shipments[0];
      shipment.order = order;
    } else if (order) {
      // Order exists in system, awaiting courier pickup and first scan (Fix #27)
      return {
        awb_number: 'Awaiting Courier Scan',
        order_id: order.order_reference || order.id,
        recipient_name: order.customer_name ? maskName(order.customer_name) : null,
        current_status: 'booked_awaiting_pickup',
        is_delayed: false,
        estimated_delivery_date: null,
        carrier: 'Awaiting Courier Allocation',
        provider: {
          display_name: 'Awaiting Courier Allocation',
          logo_url: '/logo-compressed.png',
        },
        origin: order.sender_city ? `${order.sender_city}, ${order.sender_state || ''}` : (order.pickupAddress?.city ? `${order.pickupAddress.city}, ${order.pickupAddress.state || ''}` : 'Origin Hub'),
        destination: order.shipping_city ? `${order.shipping_city}, ${order.shipping_state || ''}` : 'Customer Address',
        seller_branding: {
          company_name: order.tenant?.company_name || 'Nanoshipy Merchant Store',
          subdomain: order.tenant?.subdomain || 'store',
        },
        events: [
          {
            id: 'booked-evt-1',
            status: 'booked',
            raw_status: 'Order Placed & Booked',
            location: 'Merchant Facility',
            remark: 'Consignment confirmed by merchant. Awaiting courier pickup and first hub scan.',
            event_timestamp: order.created_at || new Date().toISOString(),
            source: 'system',
          },
        ],
      };
    }
  }

  if (!shipment) return null;

  // Proactive live fetch from Shipway tracking API if provider is shipway and active
  const provKey = String(shipment.provider?.provider_key || '').toLowerCase();
  if (provKey === 'shipway' && shipment.awb_number && shipment.status !== 'cancelled') {
    const events = shipment.trackingEvents || [];
    const latestEvent = events[0];
    const isStale = !latestEvent || (Date.now() - new Date(latestEvent.event_timestamp).getTime() > 5 * 60 * 1000);

    if (isStale) {
      try {
        const { ProviderFactory } = require('../providers');
        const providerCredentialService = require('./providerCredential.service');
        const prov = shipment.provider || (shipment.courier_provider_id ? await CourierProvider.findByPk(shipment.courier_provider_id) : null);
        if (prov && prov.credentials_encrypted) {
          const credentials = providerCredentialService.decrypt(prov.credentials_encrypted);
          const adapter = await ProviderFactory.getAdapter('shipway', credentials, prov.config || {}, prov.id);
          const trackRes = await adapter.trackShipment({ awbNumber: shipment.awb_number });

          if (trackRes.success && trackRes.data && Array.isArray(trackRes.data.history) && trackRes.data.history.length > 0) {
            const eventsToIngest = trackRes.data.history.map(h => ({
              status: h.status || 'in_transit',
              raw_status: h.remark || (h.status ? h.status.replace(/_/g, ' ').toUpperCase() : 'In Transit'),
              location: h.location || null,
              remark: h.remark || null,
              event_timestamp: h.timestamp || new Date().toISOString(),
            }));
            await ingestTrackingEvents(shipment.id, eventsToIngest, 'poll');

            // Refresh events list from database
            shipment.trackingEvents = await TrackingEvent.findAll({
              where: { shipment_id: shipment.id },
              attributes: ['id', 'status', 'raw_status', 'location', 'remark', 'event_timestamp', 'source'],
              order: [['event_timestamp', 'DESC']],
            });

            if (trackRes.data.status && trackRes.data.status !== shipment.status) {
              shipment.status = trackRes.data.status;
            }
          }
        }
      } catch (pollErr) {
        logger.warn(`[PublicTracking] Proactive Shipway tracking poll skipped: ${pollErr.message}`);
      }
    }
  }

  const origin = shipment.order?.sender_city
    ? `${shipment.order.sender_city}${shipment.order.sender_state ? ', ' + shipment.order.sender_state : ''}`
    : (shipment.order?.pickupAddress?.city
      ? `${shipment.order.pickupAddress.city}${shipment.order.pickupAddress.state ? ', ' + shipment.order.pickupAddress.state : ''}`
      : 'Origin Hub');

  const destination = shipment.order?.shipping_city 
    ? `${shipment.order.shipping_city}${shipment.order.shipping_state ? ', ' + shipment.order.shipping_state : ''}` 
    : 'Customer Destination';

  const sanitizedEvents = (shipment.trackingEvents || []).map(ev => ({
    id: ev.id,
    status: ev.status,
    raw_status: ev.raw_status,
    location: ev.location,
    remark: sanitizeRemark(ev.remark),
    event_timestamp: ev.event_timestamp,
    source: ev.source,
  }));

  // If no tracking events in database yet, provide an initial event reflecting current status
  if (sanitizedEvents.length === 0) {
    const rawStatusLabel = {
      created: 'Order Created & Consignment Booked',
      awb_generated: 'AWB Number Allocated & Ready for Pickup',
      pickup_scheduled: 'Pickup Scheduled with Carrier',
      picked_up: 'Package Picked Up by Courier',
      in_transit: 'In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Shipment Booking Cancelled',
    }[shipment.status] || (shipment.status ? shipment.status.replace(/_/g, ' ').toUpperCase() : 'In Transit');

    sanitizedEvents.push({
      id: 'init-' + shipment.id,
      status: shipment.status || 'awb_generated',
      raw_status: rawStatusLabel,
      location: origin !== 'Origin Hub' ? origin : 'Origin Facility',
      remark: 'Consignment confirmed by merchant. Awaiting courier pickup and first hub scan.',
      event_timestamp: shipment.created_at || new Date().toISOString(),
      source: 'system',
    });
  }

  // Resolve clean carrier name and logo, ensuring zero Shipway leakage
  let carrierDisplayName = null;
  try {
    const receiptPdfService = require('./receiptPdf.service');
    carrierDisplayName = receiptPdfService.getCleanCarrierName(shipment, shipment.order);
  } catch (_) {}

  if (!carrierDisplayName || carrierDisplayName.toLowerCase().includes('shipway')) {
    carrierDisplayName = shipment.courier_partner || 'Nanoshipy Express';
  }

  const carrierLogoUrl = resolveCleanCarrierLogo(carrierDisplayName);

  return {
    awb_number: shipment.awb_number || shipment.id,
    order_id: shipment.order?.order_reference || shipment.order_id || 'N/A',
    recipient_name: shipment.order?.customer_name ? maskName(shipment.order.customer_name) : null,
    current_status: shipment.status,
    is_delayed: shipment.is_delayed_flag || false,
    estimated_delivery_date: shipment.estimated_delivery_date || null,
    carrier: carrierDisplayName,
    provider: {
      display_name: carrierDisplayName,
      logo_url: carrierLogoUrl,
    },
    origin,
    destination,
    seller_branding: {
      company_name: shipment.tenant?.company_name || 'Nanoshipy Merchant Store',
      subdomain: shipment.tenant?.subdomain || 'app',
    },
    events: sanitizedEvents,
  };
}


/**
 * Flag shipments as delayed if they've had no tracking event in STUCK_THRESHOLD_HOURS
 * and are still in an active transit status.
 */
async function flagStuckShipments() {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000);

  // Find active shipments with no recent tracking event
  const stuckShipments = await Shipment.findAll({
    where: {
      status: { [Op.in]: ACTIVE_TRANSIT_STATUSES },
      is_delayed_flag: false,
    },
    include: [
      {
        model: TrackingEvent,
        as: 'trackingEvents',
        required: false,
        where: { event_timestamp: { [Op.gte]: cutoff } },
        attributes: ['id'],
      },
    ],
  });

  const stuck = stuckShipments.filter(s => s.trackingEvents.length === 0);

  if (stuck.length > 0) {
    const stuckIds = stuck.map(s => s.id);
    await Shipment.update(
      { is_delayed_flag: true },
      { where: { id: { [Op.in]: stuckIds } } },
    );
    logger.info(`[Tracking] Flagged ${stuckIds.length} shipments as delayed (stuck > ${STUCK_THRESHOLD_HOURS}h)`);
  }

  return stuck.length;
}

/**
 * Get all shipment IDs eligible for polling (active transit status, have an AWB).
 */
async function getShipmentIdsForPolling() {
  const shipments = await Shipment.findAll({
    where: {
      status: { [Op.in]: ACTIVE_TRANSIT_STATUSES },
      awb_number: { [Op.ne]: null },
    },
    attributes: ['id'],
  });
  return shipments.map(s => s.id);
}

module.exports = {
  ingestTrackingEvents,
  getTrackingTimeline,
  getPublicTracking,
  flagStuckShipments,
  getShipmentIdsForPolling,
  ACTIVE_TRANSIT_STATUSES,
};
