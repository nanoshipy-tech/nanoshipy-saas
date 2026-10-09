'use strict';

const {
  PostpaidInvoice,
  PostpaidTransaction,
  PostpaidPayment,
  SellerPaymentProfile,
  SellerPaymentTermsHistory,
  Tenant,
  PlatformAdmin,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class PostpaidBillingService {
  /**
   * Fetch complete billing summary for a seller
   */
  static async getSellerBillingSummary(tenantId) {
    const profile = await SellerPaymentProfile.findOne({ where: { tenant_id: tenantId } });
    const unpaidInvoices = await PostpaidInvoice.findAll({
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ['issued', 'partially_paid', 'overdue'] },
      },
      order: [['due_date', 'ASC']],
    });

    const unbilledTransactions = await PostpaidTransaction.findAll({
      where: {
        tenant_id: tenantId,
        invoice_id: null,
        type: 'debit',
      },
    });

    const unbilledAmount = unbilledTransactions.reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);

    return {
      profile: profile ? {
        id: profile.id,
        payment_mode: profile.payment_mode,
        credit_limit: profile.credit_limit,
        outstanding_amount: profile.outstanding_amount,
        reserved_credit: profile.reserved_credit,
        available_credit: profile.available_credit,
        billing_cycle: profile.billing_cycle,
        payment_terms_days: profile.payment_terms_days,
        status: profile.status,
      } : null,
      unbilled_amount: Math.round(unbilledAmount * 100) / 100,
      unpaid_invoices_count: unpaidInvoices.length,
      unpaid_invoices_total: unpaidInvoices.reduce((acc, inv) => acc + (parseFloat(inv.total_amount) - parseFloat(inv.paid_amount)), 0),
      unpaid_invoices: unpaidInvoices,
    };
  }

  /**
   * List postpaid invoices with pagination and filters
   */
  static async listInvoices({ tenantId, status, page = 1, limit = 20 }) {
    const where = {};
    if (tenantId) where.tenant_id = tenantId;
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await PostpaidInvoice.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'name', 'email'] },
      ],
    });

    return {
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
      invoices: rows,
    };
  }

  /**
   * List postpaid ledger transactions
   */
  static async listLedger({ tenantId, page = 1, limit = 25 }) {
    const where = {};
    if (tenantId) where.tenant_id = tenantId;

    const offset = (page - 1) * limit;
    const { count, rows } = await PostpaidTransaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'name'] },
      ],
    });

    return {
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
      transactions: rows,
    };
  }

  /**
   * Record a payment against postpaid debt and/or specific invoice
   */
  static async recordPayment({ tenantId, invoiceId = null, amount, paymentMethod, paymentReference, notes, adminId }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    const txn = await sequelize.transaction();
    try {
      let targetInvoice = null;
      if (invoiceId) {
        targetInvoice = await PostpaidInvoice.findOne({
          where: { id: invoiceId, tenant_id: tenantId },
          lock: txn.LOCK.UPDATE,
          transaction: txn,
        });
        if (!targetInvoice) {
          throw new NotFoundError('Postpaid invoice not found');
        }
      }

      // Record payment
      const payment = await PostpaidPayment.create({
        tenant_id: tenantId,
        invoice_id: targetInvoice?.id || null,
        amount: amt,
        payment_method: paymentMethod || 'bank_transfer',
        payment_reference: paymentReference || null,
        notes: notes || null,
        recorded_by: adminId || null,
        paid_at: new Date(),
      }, { transaction: txn });

      // Update invoice if specified
      if (targetInvoice) {
        const newPaid = Math.round((parseFloat(targetInvoice.paid_amount || 0) + amt) * 100) / 100;
        const total = parseFloat(targetInvoice.total_amount || 0);
        const newStatus = newPaid >= total ? 'paid' : 'partially_paid';
        await targetInvoice.update({
          paid_amount: newPaid,
          status: newStatus,
        }, { transaction: txn });
      }

      // Lock payment profile & decrease outstanding amount
      const profile = await SellerPaymentProfile.findOne({
        where: { tenant_id: tenantId },
        lock: txn.LOCK.UPDATE,
        transaction: txn,
      });

      if (profile) {
        const currentOutstanding = parseFloat(profile.outstanding_amount || 0);
        const newOutstanding = Math.max(0, Math.round((currentOutstanding - amt) * 100) / 100);
        
        const updates = { outstanding_amount: newOutstanding };
        // Auto-reactivate if suspended and within credit limit
        if (profile.status === 'suspended' && newOutstanding <= parseFloat(profile.credit_limit || 0)) {
          updates.status = 'active';
        }
        await profile.update(updates, { transaction: txn });

        // Record credit in ledger
        await PostpaidTransaction.create({
          tenant_id: tenantId,
          invoice_id: targetInvoice?.id || null,
          type: 'credit',
          amount: amt,
          balance_after: newOutstanding,
          description: `Postpaid payment received via ${paymentMethod || 'bank_transfer'} (Ref: ${paymentReference || 'N/A'})`,
          reference_id: payment.id,
        }, { transaction: txn });
      }

      await txn.commit();
      return { payment, invoice: targetInvoice, profile };
    } catch (err) {
      await txn.rollback();
      logger.error(`[PostpaidBillingService] recordPayment failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Generate billing cycle invoice for a tenant
   */
  static async generateInvoiceForTenant(tenantId, cycleStartDate, cycleEndDate, adminId = null) {
    const txn = await sequelize.transaction();
    try {
      const profile = await SellerPaymentProfile.findOne({
        where: { tenant_id: tenantId },
        transaction: txn,
      });
      if (!profile || profile.payment_mode !== 'postpaid') {
        throw new ValidationError('Tenant is not enrolled in postpaid billing');
      }

      // Find all unbilled debit transactions in cycle
      const unbilled = await PostpaidTransaction.findAll({
        where: {
          tenant_id: tenantId,
          invoice_id: null,
          type: 'debit',
          created_at: { [Op.between]: [cycleStartDate, cycleEndDate] },
        },
        lock: txn.LOCK.UPDATE,
        transaction: txn,
      });

      if (unbilled.length === 0) {
        await txn.commit();
        return null;
      }

      const subtotal = unbilled.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);
      const taxAmount = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (profile.payment_terms_days || 7));

      const invoiceNumber = `INV-POST-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const invoice = await PostpaidInvoice.create({
        invoice_number: invoiceNumber,
        tenant_id: tenantId,
        billing_period_start: cycleStartDate,
        billing_period_end: cycleEndDate,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0.00,
        due_date: dueDate,
        status: 'issued',
        line_items: unbilled.map(u => ({
          transaction_id: u.id,
          shipment_id: u.shipment_id,
          amount: u.amount,
          description: u.description,
          date: u.created_at,
        })),
      }, { transaction: txn });

      // Link transactions to invoice
      await PostpaidTransaction.update(
        { invoice_id: invoice.id },
        {
          where: { id: unbilled.map(u => u.id) },
          transaction: txn,
        }
      );

      await txn.commit();
      logger.info(`[PostpaidBillingService] Generated invoice ${invoice.invoice_number} for tenant ${tenantId}. Total: ₹${totalAmount}`);
      return invoice;
    } catch (err) {
      await txn.rollback();
      logger.error(`[PostpaidBillingService] generateInvoiceForTenant failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get terms history for a seller
   */
  static async getTermsHistory(tenantId) {
    return await SellerPaymentTermsHistory.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      include: [
        { model: PlatformAdmin, as: 'admin', attributes: ['id', 'name', 'email'] },
      ],
    });
  }
}

module.exports = PostpaidBillingService;
