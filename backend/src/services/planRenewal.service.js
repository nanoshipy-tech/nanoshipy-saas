'use strict';

const { TenantSubscription, SubscriptionPlan, PlanUsageTracking, PlanChangeHistory, Invoice, InvoiceLineItem, sequelize } = require('../models');
const walletService = require('./wallet.service');
const subscriptionPlanService = require('./subscriptionPlan.service');
const taxCalculationService = require('./taxCalculation.service');
const invoiceNumberingService = require('./invoiceNumbering.service');
const invoicePdfService = require('./invoicePdf.service');
const emailService = require('./email.service');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Core renewal engine processing a single tenant subscription renewal.
 */
async function renewSubscription(subscriptionId, parentTransaction = null) {
  const ownTxn = !parentTransaction;
  const t = parentTransaction || (await sequelize.transaction());

  try {
    // 1. Fetch subscription details
    const sub = await TenantSubscription.findByPk(subscriptionId, {
      include: [
        { model: SubscriptionPlan, as: 'plan' },
        { model: SubscriptionPlan, as: 'pendingPlan' },
      ],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!sub) {
      throw new Error(`Subscription not found for ID: ${subscriptionId}`);
    }

    const { Tenant, User } = require('../models');
    const tenant = await Tenant.findByPk(sub.tenant_id, { transaction: t });

    // If auto_renew is turned off
    if (!sub.auto_renew) {
      logger.info(`[PlanRenewal] Subscription for tenant ${sub.tenant_id} auto-renew is disabled. Cancelling subscription.`);
      
      const freePlan = await SubscriptionPlan.findOne({ where: { slug: 'free' }, transaction: t });
      
      await sub.update({
        status: 'cancelled',
        plan_id: freePlan ? freePlan.id : sub.plan_id,
        pending_plan_id: null,
      }, { transaction: t });

      await subscriptionPlanService.syncCourierAccess(sub.tenant_id, freePlan ? freePlan.courier_access_tier : 'basic', t);
      
      if (ownTxn) await t.commit();
      return;
    }

    // Resolve plan to charge (check if there's a pending downgrade scheduled)
    const targetPlan = sub.pendingPlan || sub.plan;
    const price = sub.billing_cycle === 'yearly' && targetPlan.price_yearly !== null ? targetPlan.price_yearly : targetPlan.price_monthly;

    try {
      // 2. Attempt to debit subscription price from Virtual Wallet
      if (parseFloat(price) > 0) {
        await walletService.debit(
          sub.tenant_id,
          price,
          'subscription_debit',
          targetPlan.id,
          `Auto-renewal for subscription plan: ${targetPlan.name}`,
          null, // System action
          t
        );
      }

      // Debit succeeded -> Extend cycle!
      const start = new Date();
      const end = new Date();
      if (sub.billing_cycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }

      // Check if downgrade transition was applied
      const changeType = sub.pending_plan_id ? 'downgrade' : 'renewal';

      await sub.update({
        plan_id: targetPlan.id,
        status: 'active',
        current_period_start: start,
        current_period_end: end,
        grace_period_ends_at: null,
        pending_plan_id: null,
      }, { transaction: t });

      // Create new usage tracking period
      await PlanUsageTracking.create({
        tenant_id: sub.tenant_id,
        period_start: start,
        period_end: end,
        orders_count: 0,
        users_count: 1, // Base default
      }, { transaction: t });

      // Sync courier access tier
      await subscriptionPlanService.syncCourierAccess(sub.tenant_id, targetPlan.courier_access_tier, t);

      // Log change history
      await PlanChangeHistory.create({
        tenant_id: sub.tenant_id,
        old_plan_id: sub.plan_id,
        new_plan_id: targetPlan.id,
        change_type: changeType,
        changed_by: null,
      }, { transaction: t });

      // Create Tax Invoice for the subscription renewal (Module 12 Integration)
      await createSubscriptionInvoice(tenant, targetPlan, price, t);

      // Send confirmation email
      const owner = await User.findOne({
        where: { tenant_id: sub.tenant_id },
        order: [['created_at', 'ASC']],
        transaction: t,
      });

      if (owner) {
        await emailService.sendEmail({
          to: owner.email,
          subject: `Your ${targetPlan.name} Subscription has been renewed successfully`,
          templateName: 'subscription-renewed',
          data: {
            name: owner.name,
            planName: targetPlan.name,
            price: price.toFixed(2),
            periodEnd: end.toLocaleDateString('en-IN'),
          },
        });
      }

      logger.info(`[PlanRenewal] Successfully renewed subscription for tenant ${sub.tenant_id} on ${targetPlan.name} tier.`);

      if (ownTxn) await t.commit();

    } catch (debitErr) {
      // Debit failed (insufficient balance) -> Enter grace period / Suspension checks
      const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS, 10) || 5;

      const today = new Date();

      if (sub.status !== 'grace_period' && sub.status !== 'suspended') {
        // Step 1: Move to Grace Period
        const graceEnds = new Date();
        graceEnds.setDate(graceEnds.getDate() + graceDays);

        await sub.update({
          status: 'grace_period',
          grace_period_ends_at: graceEnds,
        }, { transaction: t });

        // Email warning
        const owner = await User.findOne({
          where: { tenant_id: sub.tenant_id },
          order: [['created_at', 'ASC']],
          transaction: t,
        });

        if (owner) {
          await emailService.sendEmail({
            to: owner.email,
            subject: `Action Required: Subscription Renewal Failed for ${targetPlan.name}`,
            templateName: 'subscription-renewal-failed',
            data: {
              name: owner.name,
              planName: targetPlan.name,
              price: price.toFixed(2),
              gracePeriodDays: graceDays,
              gracePeriodEnds: graceEnds.toLocaleDateString('en-IN'),
            },
          });
        }

        logger.warn(`[PlanRenewal] Insufficient balance for tenant ${sub.tenant_id} subscription renewal. Shifted to grace period ending ${graceEnds.toDateString()}`);
      } else if (sub.status === 'grace_period' && new Date(sub.grace_period_ends_at) <= today) {
        // Step 2: Grace period expired -> Suspend accounts!
        await sub.update({
          status: 'suspended',
        }, { transaction: t });

        // Revoke non-basic courier access immediately
        const freePlan = await SubscriptionPlan.findOne({ where: { slug: 'free' }, transaction: t });
        await subscriptionPlanService.syncCourierAccess(sub.tenant_id, freePlan ? freePlan.courier_access_tier : 'basic', t);

        // Send suspension notification email
        const owner = await User.findOne({
          where: { tenant_id: sub.tenant_id },
          order: [['created_at', 'ASC']],
          transaction: t,
        });

        if (owner) {
          await emailService.sendEmail({
            to: owner.email,
            subject: `Alert: Your Workspace Access is Suspended due to unpaid renewal fee`,
            templateName: 'subscription-renewal-failed', // Reuse warning template with suspension header
            data: {
              name: owner.name,
              planName: targetPlan.name,
              price: price.toFixed(2),
              gracePeriodDays: 0,
              gracePeriodEnds: 'Suspended immediately',
            },
          });
        }

        logger.error(`[PlanRenewal] Grace period expired for tenant ${sub.tenant_id}. Subscription suspended.`);
      }

      if (ownTxn) await t.commit();
    }

  } catch (err) {
    if (ownTxn) await t.rollback();
    logger.error(`[PlanRenewal] Fatal error processing subscription renewal: ${err.message}`);
    throw err;
  }
}

/**
 * Creates invoice record for subscription renewals.
 */
async function createSubscriptionInvoice(tenant, plan, price, transaction) {
  try {
    const placeOfSupply = tenant.company_state || 'Tamil Nadu';
    const billingGstin = process.env.BILLING_ENTITY_GSTIN || '33ABCDE1234F1Z5';

    // Calculate tax splits
    const taxCalc = await taxCalculationService.calculateTax(price, billingGstin, placeOfSupply, tenant.id);
    const invoiceNumber = await invoiceNumberingService.generateNextNumber('invoice', transaction, tenant.id);

    const invoice = await Invoice.create({
      tenant_id: tenant.id,
      invoice_number: invoiceNumber,
      invoice_type: 'manual', // or subscription
      reference_type: 'wallet_recharge',
      reference_id: null,
      subtotal: price,
      cgst_amount: taxCalc.cgst_amount,
      sgst_amount: taxCalc.sgst_amount,
      igst_amount: taxCalc.igst_amount,
      total_amount: taxCalc.total_amount,
      status: 'paid',
      billing_entity_gstin: billingGstin,
      place_of_supply: placeOfSupply,
    }, { transaction });

    await InvoiceLineItem.create({
      invoice_id: invoice.id,
      description: `Subscription Renewal Charge - ${plan.name} Tier`,
      hsn_sac_code: '998412', // SAC code for digital SaaS subscription
      quantity: 1,
      unit_price: price,
      amount: price,
    }, { transaction });

    // Non-blocking background PDF generation
    invoice.tenant = tenant;
    invoicePdfService.generateInvoicePdf(invoice).then((pdfUrl) => {
      invoice.update({ pdf_url: pdfUrl }).catch(() => {});
    }).catch(() => {});

  } catch (invoiceErr) {
    logger.error(`[PlanRenewal] Subsystem invoice generation failed (non-blocking): ${invoiceErr.message}`);
  }
}

module.exports = {
  renewSubscription,
};
