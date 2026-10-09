'use strict';

const {
  SellerPaymentProfile,
  SellerPaymentTermsHistory,
  PostpaidTransaction,
  PostpaidInvoice,
  PostpaidPayment,
  Wallet,
  Tenant,
  PlatformAdmin,
  sequelize,
} = require('../models');
const walletService = require('./wallet.service');
const { InsufficientBalanceError, NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class SellerPaymentService {
  /**
   * Fetch or initialize seller payment profile.
   * Default is prepaid with 0 credit limit.
   */
  static async getPaymentProfile(tenantId, transaction = null) {
    if (!SellerPaymentProfile) {
      return {
        tenant_id: tenantId,
        payment_mode: 'prepaid',
        credit_limit: 0.00,
        outstanding_amount: 0.00,
        reserved_credit: 0.00,
        availableCredit: 0.00,
        billing_cycle: 'weekly',
        payment_terms_days: 7,
        status: 'active',
        save: async () => {},
        update: async () => {},
      };
    }
    let profile = await SellerPaymentProfile.findOne({
      where: { tenant_id: tenantId },
      transaction,
    });

    if (!profile) {
      // Auto-create default prepaid profile if it doesn't exist yet
      try {
        profile = await SellerPaymentProfile.create({
          tenant_id: tenantId,
          payment_mode: 'prepaid',
          credit_limit: 0.00,
          outstanding_amount: 0.00,
          reserved_credit: 0.00,
          billing_cycle: 'weekly',
          payment_terms_days: 7,
          status: 'active',
        }, { transaction });
      } catch (err) {
        logger.warn(`[SellerPaymentService] Profile auto-creation error: ${err.message}`);
        profile = await SellerPaymentProfile.findOne({
          where: { tenant_id: tenantId },
          transaction,
        }).catch(() => null);
      }
    }

    if (!profile) {
      profile = {
        tenant_id: tenantId,
        payment_mode: 'prepaid',
        credit_limit: 0.00,
        outstanding_amount: 0.00,
        reserved_credit: 0.00,
        available_credit: 0.00,
        billing_cycle: 'weekly',
        payment_terms_days: 7,
        status: 'active',
        save: async () => {},
        update: async () => {},
      };
    }

    return profile;
  }

  /**
   * Central authorization check: Can this seller book a shipment of estimated cost?
   */
  static async canBookShipment({ tenant_id, estimated_cost }) {
    const cost = parseFloat(estimated_cost);
    if (isNaN(cost) || cost <= 0) {
      return { allowed: false, reason: 'Invalid shipment cost quote' };
    }

    const profile = await this.getPaymentProfile(tenant_id);

    if (profile.payment_mode === 'postpaid') {
      if (profile.status === 'suspended') {
        return {
          allowed: false,
          mode: 'postpaid',
          reason: 'Postpaid account is currently suspended due to unpaid invoices or credit review.',
          available_credit: profile.available_credit,
          required: cost,
        };
      }

      const availableCredit = profile.available_credit;
      if (availableCredit < cost) {
        return {
          allowed: false,
          mode: 'postpaid',
          reason: `Insufficient credit limit. Available credit: ₹${availableCredit}, Required: ₹${cost}`,
          credit_limit: profile.credit_limit,
          outstanding_amount: profile.outstanding_amount,
          available_credit: availableCredit,
          required: cost,
        };
      }

      return {
        allowed: true,
        mode: 'postpaid',
        credit_limit: profile.credit_limit,
        outstanding_amount: profile.outstanding_amount,
        available_credit: availableCredit,
        required: cost,
      };
    }

    // Prepaid Mode: check wallet available balance
    const wallet = await Wallet.findOne({ where: { tenant_id } });
    if (!wallet) {
      return {
        allowed: false,
        mode: 'prepaid',
        reason: 'Tenant wallet not found.',
        required: cost,
      };
    }

    const availableWallet = parseFloat(
      wallet.available_balance !== undefined ? wallet.available_balance : (wallet.balance || 0)
    );
    if (availableWallet < cost) {
      return {
        allowed: false,
        mode: 'prepaid',
        reason: `Insufficient wallet balance. Available balance: ₹${availableWallet}, Required: ₹${cost}`,
        balance: wallet.balance,
        available_balance: availableWallet,
        required: cost,
      };
    }

    return {
      allowed: true,
      mode: 'prepaid',
      balance: wallet.balance,
      available_balance: availableWallet,
      required: cost,
    };
  }

  /**
   * Two-phase commit Phase 1: Reserve funds or credit limit
   */
  static async reserveShipmentPayment({ tenant_id, shipment_id, amount, transaction }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Reserve amount must be positive');

    const profile = await this.getPaymentProfile(tenant_id, transaction);

    if (profile.payment_mode === 'postpaid') {
      // Row lock the payment profile
      const lockedProfile = await SellerPaymentProfile.findOne({
        where: { id: profile.id },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (lockedProfile.status === 'suspended') {
        throw new Error('Seller postpaid account is suspended');
      }

      const availableCredit = lockedProfile.available_credit;
      if (availableCredit < amt) {
        throw new InsufficientBalanceError(`Insufficient postpaid credit. Available: ₹${availableCredit}, Required: ₹${amt}`);
      }

      const newReserved = Math.round((parseFloat(lockedProfile.reserved_credit || 0) + amt) * 100) / 100;
      await lockedProfile.update({ reserved_credit: newReserved }, { transaction });

      await PostpaidTransaction.create({
        tenant_id,
        shipment_id,
        type: 'reserve',
        amount: amt,
        balance_after: lockedProfile.outstanding_amount,
        description: `Reserved credit for shipment ${shipment_id}`,
        reference_id: String(shipment_id),
      }, { transaction });

      return { mode: 'postpaid', reserved: amt };
    }

    // Prepaid mode: delegate to walletService.reserveFunds
    await walletService.reserveFunds(tenant_id, amt, 'freight_reserve', String(shipment_id), transaction);
    return { mode: 'prepaid', reserved: amt };
  }

  /**
   * Two-phase commit Phase 2: Capture reserved funds upon courier booking confirmation
   */
  static async captureShipmentPayment({ tenant_id, shipment_id, amount, performedBy = null, transaction, description = null }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Capture amount must be positive');

    const profile = await this.getPaymentProfile(tenant_id, transaction);

    if (profile.payment_mode === 'postpaid') {
      const lockedProfile = await SellerPaymentProfile.findOne({
        where: { id: profile.id },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      const currentReserved = parseFloat(lockedProfile.reserved_credit || 0);
      const newReserved = Math.max(0, Math.round((currentReserved - amt) * 100) / 100);
      const newOutstanding = Math.round((parseFloat(lockedProfile.outstanding_amount || 0) + amt) * 100) / 100;

      await lockedProfile.update({
        reserved_credit: newReserved,
        outstanding_amount: newOutstanding,
      }, { transaction });

      await PostpaidTransaction.create({
        tenant_id,
        shipment_id,
        type: 'debit',
        amount: amt,
        balance_after: newOutstanding,
        description: description || `Shipment freight debit for shipment ${shipment_id}`,
        reference_id: String(shipment_id),
      }, { transaction });

      logger.info(`[SellerPaymentService] Captured ₹${amt} postpaid for shipment ${shipment_id}. Outstanding: ₹${newOutstanding}`);
      return { mode: 'postpaid', outstanding_amount: newOutstanding };
    }

    // Prepaid mode: delegate to walletService.captureFunds
    await walletService.captureFunds(
      tenant_id,
      amt,
      'freight_debit',
      String(shipment_id),
      description || `Shipping charge for shipment ${shipment_id}`,
      performedBy,
      transaction
    );

    return { mode: 'prepaid' };
  }

  /**
   * Two-phase commit Phase 2 (Abort): Release reserved funds if courier booking failed
   */
  static async releaseShipmentPayment({ tenant_id, shipment_id, amount, transaction }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      const profile = await this.getPaymentProfile(tenant_id, transaction);

      if (profile.payment_mode === 'postpaid') {
        const lockedProfile = await SellerPaymentProfile.findOne({
          where: { id: profile.id },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });

        const currentReserved = parseFloat(lockedProfile.reserved_credit || 0);
        const newReserved = Math.max(0, Math.round((currentReserved - amt) * 100) / 100);
        await lockedProfile.update({ reserved_credit: newReserved }, { transaction });

        await PostpaidTransaction.create({
          tenant_id,
          shipment_id,
          type: 'release',
          amount: amt,
          balance_after: lockedProfile.outstanding_amount,
          description: `Released reserved credit for failed booking of shipment ${shipment_id}`,
          reference_id: String(shipment_id),
        }, { transaction });

        logger.info(`[SellerPaymentService] Released ₹${amt} postpaid reserve for shipment ${shipment_id}`);
        return { mode: 'postpaid', released: amt };
      }

      await walletService.releaseFunds(tenant_id, amt, 'freight_release', String(shipment_id), transaction);
      return { mode: 'prepaid', released: amt };
    } catch (err) {
      logger.error(`[SellerPaymentService] Failed to release payment for shipment ${shipment_id}: ${err.message}`);
    }
  }

  /**
   * Update payment terms and mode for a seller (Admin action)
   */
  static async updatePaymentTerms({ tenantId, paymentMode, creditLimit, billingCycle, paymentTermsDays, status, reason, adminId }) {
    const txn = await sequelize.transaction();
    try {
      let profile = await SellerPaymentProfile.findOne({
        where: { tenant_id: tenantId },
        lock: txn.LOCK.UPDATE,
        transaction: txn,
      });

      if (!profile) {
        profile = await SellerPaymentProfile.create({
          tenant_id: tenantId,
          payment_mode: paymentMode || 'prepaid',
          credit_limit: creditLimit !== undefined ? creditLimit : 0.00,
          billing_cycle: billingCycle || 'weekly',
          payment_terms_days: paymentTermsDays || 7,
          status: status || 'active',
        }, { transaction: txn });
      }

      const prevMode = profile.payment_mode;
      const prevLimit = profile.credit_limit;
      const prevCycle = profile.billing_cycle;

      await profile.update({
        payment_mode: paymentMode || profile.payment_mode,
        credit_limit: creditLimit !== undefined ? creditLimit : profile.credit_limit,
        billing_cycle: billingCycle || profile.billing_cycle,
        payment_terms_days: paymentTermsDays !== undefined ? paymentTermsDays : profile.payment_terms_days,
        status: status || profile.status,
      }, { transaction: txn });

      // Record audit history
      await SellerPaymentTermsHistory.create({
        tenant_id: tenantId,
        changed_by: adminId || null,
        previous_mode: prevMode,
        new_mode: profile.payment_mode,
        previous_credit_limit: prevLimit,
        new_credit_limit: profile.credit_limit,
        previous_billing_cycle: prevCycle,
        new_billing_cycle: profile.billing_cycle,
        reason: reason || 'Terms updated by platform admin',
      }, { transaction: txn });

      await txn.commit();
      return profile;
    } catch (err) {
      await txn.rollback();
      logger.error(`[SellerPaymentService] updatePaymentTerms failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = SellerPaymentService;
