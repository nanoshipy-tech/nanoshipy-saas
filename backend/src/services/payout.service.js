'use strict';

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const auditService = require('./audit.service');
const eventBus = require('../events/eventBus');
const { ValidationError } = require('../utils/errors');

class PayoutService {
  constructor() {
    this.keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID || null;
    this.keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || null;
    this.accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER || null;
    this.baseURL = 'https://api.razorpay.com/v1';
    this.isMock = process.env.PAYOUT_PROVIDER === 'mock' || !this.accountNumber;
  }

  /**
   * Helper to decrypt AES-256-GCM bank account number string stored in tenant profile.
   */
  decryptTenantBankAccount(encryptedDataStr) {
    if (!encryptedDataStr) return null;
    try {
      const parsed = JSON.parse(encryptedDataStr);
      if (!parsed.iv || !parsed.data || !parsed.tag) return null;

      const key = process.env.ENCRYPTION_KEY
        ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32)
        : crypto.scryptSync('nanoshipy-default-encrypt-key-32c', 'salt', 32);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      logger.warn(`[PayoutService] Failed to decrypt bank account: ${err.message}`);
      return null;
    }
  }

  /**
   * Validate Indian bank account number & IFSC code format.
   */
  validateBeneficiaryDetails(accountNumber, ifsc, holderName) {
    if (!accountNumber || !/^\d{9,18}$/.test(String(accountNumber).trim())) {
      throw new ValidationError('Invalid bank account number. Must be 9-18 numeric digits.');
    }
    if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(ifsc).trim())) {
      throw new ValidationError('Invalid IFSC code format (e.g. HDFC0001234).');
    }
    if (!holderName || String(holderName).trim().length < 2) {
      throw new ValidationError('Bank account holder name is required.');
    }
    return true;
  }

  /**
   * Dispatches automated bank payout for a COD Remittance batch.
   * @param {Object} params
   * @param {string} params.batchId
   * @param {string} params.batchReference
   * @param {string} params.sellerId
   * @param {number} params.amount
   * @param {Object} params.beneficiary - { accountNumber, ifsc, holderName, email, phone }
   * @param {string} [params.mode] - 'NEFT' | 'RTGS' | 'IMPS' (default: 'IMPS' for <= 2L, 'NEFT' for > 2L)
   * @param {string} [params.adminId]
   */
  async disburseRemittancePayout({
    batchId,
    batchReference,
    sellerId,
    amount,
    beneficiary,
    mode = null,
    adminId = null,
  }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new ValidationError('Remittance payout amount must be greater than zero.');
    }

    this.validateBeneficiaryDetails(beneficiary.accountNumber, beneficiary.ifsc, beneficiary.holderName);

    const determinedMode = mode || (amt > 200000 ? 'NEFT' : 'IMPS');
    const idempotencyKey = `payout_${batchId}_${batchReference}`.slice(0, 40);

    if (this.isMock) {
      return this._executeSimulatedPayout({
        batchId,
        batchReference,
        sellerId,
        amount: amt,
        beneficiary,
        mode: determinedMode,
        adminId,
      });
    }

    return this._executeRazorpayXPayout({
      batchId,
      batchReference,
      sellerId,
      amount: amt,
      beneficiary,
      mode: determinedMode,
      idempotencyKey,
      adminId,
    });
  }

  /**
   * Dispatches real transfer via RazorpayX Composite Payout API.
   */
  async _executeRazorpayXPayout({
    batchId,
    batchReference,
    sellerId,
    amount,
    beneficiary,
    mode,
    idempotencyKey,
    adminId,
  }) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const amountPaise = Math.round(amount * 100);

      // RazorpayX Composite Payout payload creates contact + fund_account + payout atomically
      const payoutPayload = {
        account_number: this.accountNumber,
        amount: amountPaise,
        currency: 'INR',
        mode: mode,
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `REM-${batchId.slice(0, 8)}`,
        narration: `COD Remit ${batchReference.slice(0, 15)}`,
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: beneficiary.holderName,
            ifsc: beneficiary.ifsc.toUpperCase(),
            account_number: beneficiary.accountNumber,
          },
          contact: {
            name: beneficiary.holderName,
            email: beneficiary.email || 'seller@nanoshipy.com',
            contact: beneficiary.phone || '9999999999',
            type: 'vendor',
            reference_id: sellerId,
          },
        },
      };

      logger.info(`[PayoutService] Dispatching RazorpayX payout for batch ${batchId}, amount ₹${amount}`);

      const response = await axios.post(`${this.baseURL}/payouts`, payoutPayload, {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'X-Payout-Idempotency': idempotencyKey,
        },
        timeout: 20000,
      });

      const data = response.data;
      const payoutId = data.id;
      const status = data.status; // 'processing' | 'processed' | 'queued'
      const utr = data.utr || null;

      await auditService.log({
        tenant_id: sellerId,
        user_id: adminId,
        action: 'cod_remittance_payout_dispatched',
        entity_type: 'cod_remittance',
        entity_id: batchId,
        metadata: {
          payout_id: payoutId,
          status,
          utr,
          mode,
          amount,
          batch_reference: batchReference,
        },
      });

      return {
        success: true,
        payoutId,
        status: status === 'processed' ? 'completed' : 'processing',
        utr,
        mode,
        provider: 'razorpayx',
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.description || err.message;
      logger.error(`[PayoutService] RazorpayX payout failed for batch ${batchId}: ${errorMsg}`, {
        error: err.response?.data,
      });
      throw new Error(`Bank payout execution failed: ${errorMsg}`);
    }
  }

  /**
   * Simulated Bank Payout execution for local testing and sandbox staging.
   */
  async _executeSimulatedPayout({
    batchId,
    batchReference,
    sellerId,
    amount,
    beneficiary,
    mode,
    adminId,
  }) {
    logger.info(`[PayoutService][Mock] Simulating bank payout of ₹${amount} to ${beneficiary.ifsc} / ${beneficiary.holderName}`);

    const simulatedPayoutId = `pout_sim_${crypto.randomBytes(8).toString('hex')}`;
    const simulatedUtr = `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    await auditService.log({
      tenant_id: sellerId,
      user_id: adminId,
      action: 'cod_remittance_payout_simulated',
      entity_type: 'cod_remittance',
      entity_id: batchId,
      metadata: {
        payout_id: simulatedPayoutId,
        utr: simulatedUtr,
        amount,
        beneficiary_masked: `...${String(beneficiary.accountNumber).slice(-4)}`,
        mode,
      },
    });

    return {
      success: true,
      payoutId: simulatedPayoutId,
      status: 'completed',
      utr: simulatedUtr,
      mode,
      provider: 'simulator',
    };
  }

  /**
   * Webhook processor for inbound RazorpayX Payout state changes.
   */
  async handleWebhook(rawBody, signature, secret) {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))) {
      throw new Error('Invalid payout webhook signature');
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;
    const payout = payload.payload?.payout?.entity;

    if (!payout) return { ignored: true };

    logger.info(`[PayoutService] Received webhook event ${event} for payout ${payout.id}`);

    const { CodRemittance } = require('../models');
    const remittance = await CodRemittance.findOne({
      where: { payout_reference: payout.id },
    });

    if (!remittance) {
      logger.warn(`[PayoutService] No remittance found for payout reference ${payout.id}`);
      return { handled: false };
    }

    if (event === 'payout.processed') {
      await remittance.update({
        status: 'completed',
        completed_at: new Date(),
        metadata: {
          ...(remittance.metadata || {}),
          utr: payout.utr,
          processed_at: payout.processed_at,
        },
      });
      eventBus.emit('cod_remittance.completed', {
        batch_id: remittance.id,
        seller_id: remittance.seller_id,
        utr: payout.utr,
      });
    } else if (event === 'payout.failed' || event === 'payout.reversed') {
      await remittance.update({
        status: 'failed',
        failure_reason: payout.failure_reason || `Payout ${event}`,
      });
      eventBus.emit('cod_remittance.failed', {
        batch_id: remittance.id,
        seller_id: remittance.seller_id,
        error: payout.failure_reason,
      });
    }

    return { handled: true, event };
  }
}

module.exports = new PayoutService();
