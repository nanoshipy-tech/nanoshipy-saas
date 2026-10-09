'use strict';

const { Manifest, Shipment, Order, CourierProvider, PickupAddress, sequelize } = require('../models');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');
const eventBus = require('../events/eventBus');

class ManifestService {
  /**
   * Create a shipping manifest for handover to courier representative
   */
  async createManifest(tenantId, userId, data) {
    const { courier_provider_id, pickup_address_id, shipment_ids, pickup_date } = data;

    if (!shipment_ids || !Array.isArray(shipment_ids) || shipment_ids.length === 0) {
      throw new BadRequestError('At least one shipment must be selected for manifest generation');
    }

    return sequelize.transaction(async (t) => {
      // 1. Fetch shipments with lock
      const shipments = await Shipment.findAll({
        where: {
          id: shipment_ids,
          tenant_id: tenantId,
        },
        include: [{ model: Order, as: 'order' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (shipments.length !== shipment_ids.length) {
        throw new BadRequestError('One or more selected shipments were not found or do not belong to this account');
      }

      // 2. Validate shipment statuses (only created or awb_generated)
      const validStatuses = ['created', 'awb_generated'];
      let totalWeight = 0;

      for (const ship of shipments) {
        if (!validStatuses.includes(ship.status)) {
          throw new BadRequestError(`Shipment ${ship.awb_number || ship.id} is in status "${ship.status}" and cannot be manifested.`);
        }
        if (ship.manifest_id) {
          throw new BadRequestError(`Shipment ${ship.awb_number || ship.id} is already part of an existing manifest.`);
        }
        totalWeight += parseFloat(ship.declared_weight_kg || 0);
      }

      // 3. Generate unique manifest number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const manifestNumber = `MAN-${dateStr}-${randomSuffix}`;

      // 4. Create Manifest
      const manifest = await Manifest.create({
        tenant_id: tenantId,
        manifest_number: manifestNumber,
        courier_provider_id: courier_provider_id || shipments[0].courier_provider_id,
        pickup_address_id: pickup_address_id || shipments[0].pickup_address_id,
        shipment_count: shipments.length,
        total_weight_kg: Math.round(totalWeight * 1000) / 1000,
        status: 'created',
        pickup_scheduled_date: pickup_date ? new Date(pickup_date) : new Date(),
        created_by: userId,
      }, { transaction: t });

      // 5. Update shipments to point to this manifest and transition status
      await Shipment.update({
        manifest_id: manifest.id,
        status: 'pickup_scheduled',
      }, {
        where: { id: shipment_ids },
        transaction: t,
      });

      logger.info(`[ManifestService] Created manifest ${manifestNumber} with ${shipments.length} shipments for tenant ${tenantId}`);

      // 6. Emit event post-commit
      setImmediate(() => {
        eventBus.emit('manifest.created', {
          tenant_id: tenantId,
          manifest_id: manifest.id,
          manifest_number: manifestNumber,
          shipment_count: shipments.length,
        });
      });

      return {
        manifest,
        shipments: shipments.map(s => ({
          id: s.id,
          awb_number: s.awb_number,
          order_reference: s.order?.order_reference,
          customer_name: s.order?.customer_name,
          declared_weight_kg: s.declared_weight_kg,
          destination_pincode: s.order?.shipping_pincode,
        })),
      };
    });
  }

  async getManifest(id, tenantId) {
    const manifest = await Manifest.findOne({
      where: { id, tenant_id: tenantId },
      include: [
        { model: CourierProvider, as: 'courierProvider', attributes: ['id', 'display_name', 'provider_key'] },
        { model: PickupAddress, as: 'pickupAddress' },
      ],
    });

    if (!manifest) {
      throw new NotFoundError('Manifest not found');
    }

    const shipments = await Shipment.findAll({
      where: { manifest_id: manifest.id, tenant_id: tenantId },
      include: [{ model: Order, as: 'order' }],
    });

    return { manifest, shipments };
  }

  async listManifests(tenantId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    return Manifest.findAndCountAll({
      where: { tenant_id: tenantId },
      include: [
        { model: CourierProvider, as: 'courierProvider', attributes: ['id', 'display_name', 'provider_key'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  }

  async generateManifest(tenantId, userId, data) {
    return this.createManifest(tenantId, userId, data);
  }
}

module.exports = new ManifestService();
