'use strict';

const weightDisputeRepository = require('../repositories/weightDispute.repository');
const walletService = require('./wallet.service');
const { Shipment, WalletTransaction } = require('../models');
const { DisputeWindowExpiredError, NotFoundError, BadRequestError } = require('../utils/errors');
const eventBus = require('../events/eventBus');
const logger = require('../utils/logger');

const DISPUTE_WINDOW_DAYS = parseInt(process.env.WEIGHT_DISPUTE_WINDOW_DAYS, 10) || 7;

class WeightDisputeService {
  /**
   * File a new weight discrepancy dispute.
   * Checks the dispute window: shipment must have been booked within DISPUTE_WINDOW_DAYS.
   */
  async fileDispute(tenantId, data) {
    const { shipment_id, seller_declared_weight_kg, carrier_charged_weight_kg, seller_evidence_s3_key } = data;

    const shipment = await Shipment.findOne({ where: { id: shipment_id, tenant_id: tenantId } });
    if (!shipment) throw new NotFoundError('Shipment not found');

    // Check dispute window
    const bookedAt = shipment.created_at || shipment.createdAt;
    const cutoff = new Date(bookedAt);
    cutoff.setDate(cutoff.getDate() + DISPUTE_WINDOW_DAYS);

    if (new Date() > cutoff) {
      throw new DisputeWindowExpiredError(
        `Weight disputes must be filed within ${DISPUTE_WINDOW_DAYS} days of booking. This shipment was booked on ${bookedAt.toISOString().split('T')[0]}.`
      );
    }

    // Check if dispute already exists for this shipment
    const existing = await weightDisputeRepository.findByShipmentId(shipment_id);
    if (existing) {
      throw new BadRequestError('A weight dispute already exists for this shipment.');
    }

    const dispute = await weightDisputeRepository.create({
      seller_id: tenantId,
      shipment_id,
      seller_declared_weight_kg,
      carrier_charged_weight_kg,
      seller_evidence_s3_key: seller_evidence_s3_key || null,
      status: 'pending',
    });

    logger.info(`[WeightDisputeService] Dispute filed for shipment ${shipment_id} by tenant ${tenantId}`);
    return dispute;
  }

  /**
   * Admin resolves the dispute — either accepts (credit wallet) or rejects.
   */
  async resolveDispute(id, adminId, { resolution, admin_notes, approved_weight_kg }) {
    const dispute = await weightDisputeRepository.findById(id);
    if (!dispute) throw new NotFoundError('Weight dispute not found');

    if (dispute.status !== 'pending') {
      throw new BadRequestError(`Dispute is already ${dispute.status}.`);
    }

    const updates = {
      status: resolution === 'accepted' ? 'accepted' : 'rejected',
      admin_notes,
      resolved_at: new Date(),
      resolved_by: adminId,
    };

    if (resolution === 'accepted' && approved_weight_kg) {
      updates.approved_weight_kg = approved_weight_kg;

      // Calculate reversal credit amount
      // Diff = (carrier_charged - approved) * per_kg_rate
      const perKgRate = parseFloat(process.env.WEIGHT_DISPUTE_PER_KG_RATE || '10');
      const weightDiff = parseFloat(dispute.carrier_charged_weight_kg) - parseFloat(approved_weight_kg);
      const creditAmount = Math.max(0, weightDiff * perKgRate);

      if (creditAmount > 0) {
        await walletService.credit(
          dispute.seller_id,
          creditAmount,
          'weight_dispute_reversal',
          dispute.id,
          `Weight dispute reversal for shipment ${dispute.shipment_id}`,
          adminId
        );
        updates.credit_amount_issued = creditAmount;
        logger.info(`[WeightDisputeService] Credited ₹${creditAmount} to tenant ${dispute.seller_id} for dispute ${id}`);
      }
    }

    const resolved = await weightDisputeRepository.update(id, updates);

    eventBus.emit('weight_dispute.resolved', {
      tenant_id: dispute.seller_id,
      dispute_id: id,
      shipment_id: dispute.shipment_id,
      resolution,
    });

    return resolved;
  }

  /**
   * Ingest a weight discrepancy report/webhook from carrier.
   * Auto-matches to shipment, flags it, notifies merchant, and starts dispute countdown.
   */
  async ingestCarrierDiscrepancy({ awbNumber, courierWeightKg, additionalCharge, carrierReason }) {
    const shipment = await Shipment.findOne({ where: { awb_number: awbNumber } });
    if (!shipment) {
      logger.warn(`[WeightDisputeService] Shipment not found for AWB: ${awbNumber}`);
      return null;
    }

    await shipment.update({ weight_discrepancy_flag: true });

    let dispute = await weightDisputeRepository.findByShipmentId(shipment.id);
    if (!dispute) {
      dispute = await weightDisputeRepository.create({
        seller_id: shipment.tenant_id,
        shipment_id: shipment.id,
        awb: awbNumber,
        declared_weight_kg: shipment.declared_weight_kg,
        courier_weight_kg: courierWeightKg,
        disputed_charge: parseFloat(additionalCharge || 0),
        status: 'open',
        admin_note: carrierReason || 'Carrier reported weight discrepancy at sorting hub',
      });
    }

    eventBus.emit('weight_discrepancy.flagged', {
      tenant_id: shipment.tenant_id,
      shipment_id: shipment.id,
      awb: awbNumber,
      declared_weight: shipment.declared_weight_kg,
      courier_weight: courierWeightKg,
      additional_charge: additionalCharge,
    });

    logger.info(`[WeightDisputeService] Weight discrepancy ingested for AWB ${awbNumber}: Declared=${shipment.declared_weight_kg}kg, Courier=${courierWeightKg}kg`);
    return dispute;
  }

  async listDisputes(tenantId = null, options = {}) {
    const where = {};
    if (tenantId) where.seller_id = tenantId;
    return weightDisputeRepository.list({ where, ...options });
  }

  async getDispute(id, tenantId = null) {
    return weightDisputeRepository.findById(id, tenantId);
  }
}

module.exports = new WeightDisputeService();
