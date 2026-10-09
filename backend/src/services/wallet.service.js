'use strict';

const { Wallet, WalletTransaction, User, sequelize } = require('../models');
const { InsufficientBalanceError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');
const auditService = require('./audit.service');

/**
 * Core: credit a tenant's wallet.
 */
async function credit(tenantId, amount, referenceType, referenceId, description, performedBy = null, transaction = null, returnDetails = false) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());

  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Credit amount must be positive');
    }

    // 1. Lock the wallet row to prevent concurrent updates
    const wallet = await Wallet.findOne({
      where: { tenant_id: tenantId },
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });

    if (!wallet) {
      throw new NotFoundError('Tenant wallet not found');
    }

    // 2. Strict Idempotency Check: if referenceType and referenceId exist, check for duplicate credit
    if (referenceType && referenceId && typeof WalletTransaction?.findOne === 'function') {
      const existingTx = await WalletTransaction.findOne({
        where: {
          tenant_id: tenantId,
          reference_type: referenceType,
          reference_id: String(referenceId),
        },
        transaction: txn,
      });

      if (existingTx) {
        logger.info(`[WalletService] Idempotency match: transaction already exists for reference ${referenceType}:${referenceId}`);
        const currentBal = parseFloat(wallet.balance);
        if (ownTxn) await txn.commit();
        return returnDetails ? { balance: currentBal, transaction: existingTx, id: existingTx.id } : currentBal;
      }
    }

    const currentBalance = parseFloat(wallet.balance);
    const newBalance = Math.round((currentBalance + amt) * 100) / 100;

    // Resolve performer in merchant users table (avoid FK violation if platform admin)
    let validPerformer = null;
    if (performedBy && User && typeof User.findByPk === 'function') {
      const u = await User.findByPk(performedBy, { attributes: ['id'], transaction: txn });
      if (u) validPerformer = u.id;
    }

    // 3. Insert into the immutable transaction ledger
    const ledgerTx = await WalletTransaction.create({
      wallet_id: wallet.id,
      tenant_id: tenantId,
      type: 'credit',
      amount: amt,
      balance_after: newBalance,
      reference_type: referenceType,
      reference_id: referenceId ? String(referenceId) : null,
      description,
      performed_by: validPerformer,
    }, { transaction: txn });

    // 4. Update the denormalized wallet balance cache
    await wallet.update({ balance: newBalance }, { transaction: txn });

    // 5. Audit Log
    await auditService.log({
      tenant_id: tenantId,
      user_id: validPerformer,
      action: 'wallet_recharge_completed',
      entity_type: 'wallet_transaction',
      entity_id: ledgerTx.id,
      metadata: { amount: amt, type: 'credit', reference_type: referenceType, new_balance: newBalance },
      transaction: txn,
    });

    if (ownTxn) await txn.commit();
    return returnDetails ? { balance: newBalance, transaction: ledgerTx, id: ledgerTx.id } : newBalance;
  } catch (err) {
    if (ownTxn) await txn.rollback();
    logger.error(`[WalletService] Credit transaction failed: ${err.message}`);
    throw err;
  }
}

/**
 * Core: debit a tenant's wallet.
 */
async function debit(tenantId, amount, referenceType, referenceId, description, performedBy = null, transaction = null, returnDetails = false) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());

  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Debit amount must be positive');
    }

    // 1. Lock the wallet row
    const wallet = await Wallet.findOne({
      where: { tenant_id: tenantId },
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });

    if (!wallet) {
      throw new NotFoundError('Tenant wallet not found');
    }

    // 2. Strict Idempotency Check: if referenceType and referenceId exist, check for duplicate debit
    if (referenceType && referenceId && typeof WalletTransaction?.findOne === 'function') {
      const existingTx = await WalletTransaction.findOne({
        where: {
          tenant_id: tenantId,
          reference_type: referenceType,
          reference_id: String(referenceId),
        },
        transaction: txn,
      });

      if (existingTx) {
        logger.info(`[WalletService] Idempotency match: debit already exists for reference ${referenceType}:${referenceId}`);
        const currentBal = parseFloat(wallet.balance);
        if (ownTxn) await txn.commit();
        return returnDetails ? { balance: currentBal, transaction: existingTx, id: existingTx.id } : currentBal;
      }
    }

    const currentBalance = parseFloat(wallet.balance);
    const creditLimit = parseFloat(wallet.credit_limit || 0);
    const heldBalance = parseFloat(wallet.held_balance || 0);
    if ((currentBalance + creditLimit - heldBalance) < amt) {
      throw new InsufficientBalanceError();
    }

    const newBalance = Math.round((currentBalance - amt) * 100) / 100;

    // Resolve performer in merchant users table (avoid FK violation if platform admin)
    let validPerformer = null;
    if (performedBy && User && typeof User.findByPk === 'function') {
      const u = await User.findByPk(performedBy, { attributes: ['id'], transaction: txn });
      if (u) validPerformer = u.id;
    }

    // 3. Write ledger entry
    const ledgerTx = await WalletTransaction.create({
      wallet_id: wallet.id,
      tenant_id: tenantId,
      type: 'debit',
      amount: amt,
      balance_after: newBalance,
      reference_type: referenceType,
      reference_id: referenceId ? String(referenceId) : null,
      description,
      performed_by: validPerformer,
    }, { transaction: txn });

    // 4. Update wallet balance
    await wallet.update({ balance: newBalance }, { transaction: txn });

    // 5. Audit Log
    await auditService.log({
      tenant_id: tenantId,
      user_id: validPerformer,
      action: 'wallet_debit',
      entity_type: 'wallet_transaction',
      entity_id: ledgerTx.id,
      metadata: { amount: amt, type: 'debit', reference_type: referenceType, new_balance: newBalance },
      transaction: txn,
    });

    // 6. Check low balance alert threshold
    if (newBalance < parseFloat(wallet.low_balance_threshold)) {
      onLowBalance(tenantId, newBalance, parseFloat(wallet.low_balance_threshold));
    }

    if (ownTxn) await txn.commit();

    // GST Invoice: on freight_debit, generate a compliant GST invoice PDF asynchronously
    if (referenceType === 'freight_debit') {
      setImmediate(async () => {
        try {
          const invoiceService = require('./invoice.service');
          if (invoiceService.generateFreightDebitInvoice) {
            const s3Key = await invoiceService.generateFreightDebitInvoice(ledgerTx.id, tenantId, amt);
            if (s3Key) {
              await WalletTransaction.update({ invoice_s3_key: s3Key }, { where: { id: ledgerTx.id } });
              logger.info(`[WalletService] GST invoice generated for freight_debit ${ledgerTx.id}: ${s3Key}`);
            }
          }
        } catch (invoiceErr) {
          logger.error(`[WalletService] GST invoice generation failed for txn ${ledgerTx.id}: ${invoiceErr.message}`);
        }
      });
    }

    return returnDetails ? { balance: newBalance, transaction: ledgerTx, id: ledgerTx.id } : newBalance;
  } catch (err) {
    if (ownTxn) await txn.rollback();
    logger.error(`[WalletService] Debit transaction failed: ${err.message}`);
    throw err;
  }
}

/**
 * Pre-validation locking check before booking shipments to block early.
 */
async function checkBalanceForShipment(tenantId, amount, transaction) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    throw new Error('Valid rate quote amount required');
  }

  const wallet = await Wallet.findOne({
    where: { tenant_id: tenantId },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  if (!wallet) {
    throw new NotFoundError('Tenant wallet not found');
  }

  const available = parseFloat(wallet.balance) + parseFloat(wallet.credit_limit || 0) - parseFloat(wallet.held_balance || 0);
  if (available < amt) {
    throw new InsufficientBalanceError();
  }

  return wallet;
}

/**
 * Two-phase commit: Reserve funds for shipment booking
 */
async function reserveFunds(tenantId, amount, referenceType, referenceId, transaction = null) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());
  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Reserve amount must be positive');

    const wallet = await Wallet.findOne({
      where: { tenant_id: tenantId },
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });
    if (!wallet) throw new NotFoundError('Tenant wallet not found');

    const available = parseFloat(wallet.balance) + parseFloat(wallet.credit_limit || 0) - parseFloat(wallet.held_balance || 0);
    if (available < amt) {
      throw new InsufficientBalanceError('Insufficient available wallet balance to reserve shipping funds');
    }

    const newHeld = Math.round((parseFloat(wallet.held_balance || 0) + amt) * 100) / 100;
    await wallet.update({ held_balance: newHeld }, { transaction: txn });

    if (ownTxn) await txn.commit();
    return { wallet, held_balance: newHeld };
  } catch (err) {
    if (ownTxn) await txn.rollback();
    throw err;
  }
}

/**
 * Two-phase commit: Capture reserved funds upon carrier booking confirmation
 */
async function captureFunds(tenantId, amount, referenceType, referenceId, description, performedBy = null, transaction = null) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());
  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Capture amount must be positive');

    const wallet = await Wallet.findOne({
      where: { tenant_id: tenantId },
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });
    if (!wallet) throw new NotFoundError('Tenant wallet not found');

    const currentBalance = parseFloat(wallet.balance);
    const newBalance = Math.round((currentBalance - amt) * 100) / 100;
    const currentHeld = parseFloat(wallet.held_balance || 0);
    const newHeld = Math.max(0, Math.round((currentHeld - amt) * 100) / 100);

    const ledgerTx = await WalletTransaction.create({
      wallet_id: wallet.id,
      tenant_id: tenantId,
      type: 'debit',
      amount: amt,
      balance_after: newBalance,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      performed_by: performedBy,
    }, { transaction: txn });

    await wallet.update({ balance: newBalance, held_balance: newHeld }, { transaction: txn });

    if (newBalance < parseFloat(wallet.low_balance_threshold)) {
      onLowBalance(tenantId, newBalance, parseFloat(wallet.low_balance_threshold));
    }

    if (ownTxn) await txn.commit();
    return newBalance;
  } catch (err) {
    if (ownTxn) await txn.rollback();
    throw err;
  }
}

/**
 * Two-phase commit: Release reserved funds if carrier booking failed or timed out
 */
async function releaseFunds(tenantId, amount, referenceType, referenceId, transaction = null) {
  const ownTxn = !transaction;
  const txn = transaction || (await sequelize.transaction());
  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Release amount must be positive');

    const wallet = await Wallet.findOne({
      where: { tenant_id: tenantId },
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });
    if (!wallet) return;

    const currentHeld = parseFloat(wallet.held_balance || 0);
    const newHeld = Math.max(0, Math.round((currentHeld - amt) * 100) / 100);
    await wallet.update({ held_balance: newHeld }, { transaction: txn });

    if (ownTxn) await txn.commit();
    return newHeld;
  } catch (err) {
    if (ownTxn) await txn.rollback();
    throw err;
  }
}

/**
 * Recalculate wallets.balance directly from ledger database records.
 * Solves anomalies or discrepancies.
 */
async function reconcileWalletBalance(walletId) {
  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findByPk(walletId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!wallet) return 0;

    const credits = await WalletTransaction.sum('amount', {
      where: { wallet_id: walletId, type: 'credit' },
      transaction: t,
    }) || 0;

    const debits = await WalletTransaction.sum('amount', {
      where: { wallet_id: walletId, type: 'debit' },
      transaction: t,
    }) || 0;

    const computedBalance = Number((credits - debits).toFixed(2));
    await wallet.update({ balance: computedBalance }, { transaction: t });

    logger.info(`[WalletReconciliation] Reconciled wallet ${walletId}: Credits=${credits}, Debits=${debits}, CachedBalance=${wallet.balance}, FixedBalance=${computedBalance}`);
    return computedBalance;
  });
}

// Low balance event hook
function onLowBalance(tenantId, currentBalance, threshold) {
  logger.warn(`[WalletService] LOW_BALANCE alert triggered for tenant ${tenantId}: Current balance ₹${currentBalance} is below threshold ₹${threshold}`);
  const eventBus = require('../events/eventBus');
  eventBus.emit('wallet.low_balance', {
    tenant_id: tenantId,
    balance: currentBalance,
    threshold,
  });
}

module.exports = {
  credit,
  debit,
  checkBalanceForShipment,
  reserveFunds,
  captureFunds,
  releaseFunds,
  reconcileWalletBalance,
  onLowBalance,
};
