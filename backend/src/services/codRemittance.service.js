'use strict';

const codRemittanceRepository = require('../repositories/codRemittance.repository');
const walletService = require('./wallet.service');
const { CodRemittance, Shipment } = require('../models');
const { CodRemittanceBalanceMismatchError, NotFoundError } = require('../utils/errors');
const eventBus = require('../events/eventBus');
const sequelize = require('../config/db.config');
const logger = require('../utils/logger');

class CodRemittanceService {
  async createBatch(data) {
    const { seller_id, shipment_ids, gross_amount, platform_fee, remittance_mode } = data;

    const gross = parseFloat(gross_amount);
    const fee = parseFloat(platform_fee);
    const net = gross - fee;

    // Validate gross - fee = net
    if (Math.abs(gross - fee - net) > 0.01) {
      throw new CodRemittanceBalanceMismatchError('Gross amount minus platform fee must equal net amount');
    }

    const batchReference = `COD-REM-${Date.now()}`;

    return codRemittanceRepository.create({
      seller_id,
      shipment_ids,
      gross_cod_amount: gross,
      platform_fee_deducted: fee,
      net_amount: net,
      remittance_mode,
      batch_reference: batchReference,
      status: 'pending',
    });
  }

  async processBatch(id, adminId) {
    const batch = await codRemittanceRepository.findById(id);
    if (!batch) throw new NotFoundError('Remittance batch not found');

    if (batch.status === 'completed' || batch.status === 'processing') {
      return batch; // Already processed or in progress
    }

    await batch.update({ status: 'processing' });

    try {
      if (batch.remittance_mode === 'wallet_credit') {
        // Credit the seller wallet
        await walletService.credit(
          batch.seller_id,
          batch.net_amount,
          'cod_remittance',
          batch.id,
          `COD Remittance Batch Credit: Ref ${batch.batch_reference}`,
          adminId
        );

        await batch.update({
          status: 'completed',
          completed_at: new Date(),
        });
      } else {
        // Direct Bank Payout via automated PayoutService
        const payoutService = require('./payout.service');
        const { Tenant } = require('../models');
        const tenant = await Tenant.findByPk(batch.seller_id);

        if (!tenant) {
          throw new NotFoundError('Merchant tenant record not found');
        }

        const rawAccNumber = payoutService.decryptTenantBankAccount(tenant.bank_account_number_encrypted);
        const ifsc = tenant.bank_ifsc;
        const holderName = tenant.bank_account_holder_name || tenant.legal_business_name || tenant.name;

        if (!rawAccNumber || !ifsc) {
          throw new Error('Merchant bank account details (account number & IFSC) are not configured or verified for direct bank remittance.');
        }

        const payoutResult = await payoutService.disburseRemittancePayout({
          batchId: batch.id,
          batchReference: batch.batch_reference,
          sellerId: batch.seller_id,
          amount: batch.net_amount,
          beneficiary: {
            accountNumber: rawAccNumber,
            ifsc: ifsc,
            holderName: holderName,
            email: tenant.support_email || null,
            phone: tenant.support_phone || null,
          },
          adminId,
        });

        await batch.update({
          status: payoutResult.status === 'processing' ? 'processing' : 'completed',
          payout_reference: payoutResult.payoutId,
          completed_at: payoutResult.status === 'completed' ? new Date() : null,
          metadata: {
            ...(batch.metadata || {}),
            utr: payoutResult.utr,
            payout_provider: payoutResult.provider,
            mode: payoutResult.mode,
          },
        });
      }

      const auditService = require('./audit.service');
      await auditService.log({
        tenant_id: batch.seller_id,
        user_id: adminId,
        action: 'cod_remittance_processed',
        entity_type: 'cod_remittance',
        entity_id: batch.id,
        metadata: { batch_reference: batch.batch_reference, amount: batch.net_amount },
      });

      eventBus.emit('cod_remittance.completed', { batch_id: batch.id, seller_id: batch.seller_id });

      return batch;
    } catch (err) {
      logger.error(`[CodRemittanceService] Failed to process batch ${id}: ${err.message}`);
      await batch.update({ status: 'failed' });
      
      eventBus.emit('cod_remittance.failed', { batch_id: batch.id, seller_id: batch.seller_id, error: err.message });
      throw err;
    }
  }

  /**
   * Reconciles courier lump-sum settlement remittance entries.
   * Matches AWBs, verifies COD amounts, identifies discrepancies, and organizes matched shipments by merchant.
   */
  async reconcileCourierSettlement(entries) {
    const matched = [];
    const discrepancies = [];
    const { Order } = require('../models');

    for (const item of entries) {
      const { awbNumber, collectedAmount, courierFee, utrReference } = item;
      const shipment = await Shipment.findOne({
        where: { awb_number: awbNumber },
        include: [{ model: Order, as: 'order' }],
      });

      if (!shipment) {
        discrepancies.push({ awbNumber, reason: 'AWB_NOT_FOUND', raw: item });
        continue;
      }

      if (shipment.order && shipment.order.payment_mode !== 'cod') {
        discrepancies.push({ awbNumber, reason: 'ORDER_NOT_COD', raw: item });
        continue;
      }

      const expectedAmount = parseFloat(shipment.order?.cod_amount || shipment.order?.order_value || 0);
      const receivedAmount = parseFloat(collectedAmount);

      if (Math.abs(expectedAmount - receivedAmount) > 1.0) {
        discrepancies.push({
          awbNumber,
          shipmentId: shipment.id,
          tenantId: shipment.tenant_id,
          expectedAmount,
          receivedAmount,
          difference: receivedAmount - expectedAmount,
          reason: 'AMOUNT_MISMATCH',
          raw: item,
        });
        continue;
      }

      matched.push({
        shipmentId: shipment.id,
        awbNumber,
        tenantId: shipment.tenant_id,
        collectedAmount: receivedAmount,
        courierFee: parseFloat(courierFee || 0),
        utrReference,
      });
    }

    logger.info(`[CodRemittanceService] Settlement reconciliation: ${matched.length} matched, ${discrepancies.length} discrepancies`);
    return { matched, discrepancies };
  }

  async listBatches(sellerId = null, options = {}) {
    const where = {};
    if (sellerId) where.seller_id = sellerId;
    return codRemittanceRepository.list({ where, ...options });
  }

  async getBatchDetails(id, sellerId = null) {
    return codRemittanceRepository.findById(id, sellerId);
  }
}

module.exports = new CodRemittanceService();
