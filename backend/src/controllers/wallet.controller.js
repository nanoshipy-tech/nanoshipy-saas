'use strict';

const walletService = require('../services/wallet.service');
const walletTransactionRepository = require('../repositories/walletTransaction.repository');
const { Wallet } = require('../models');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');

/**
 * Get tenant wallet balance and configuration.
 */
async function getWallet(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    let wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
    if (!wallet) {
      wallet = await Wallet.create({ tenant_id: tenantId, balance: 0.0, low_balance_threshold: 500.0 });
    }
    return success(res, wallet);
  } catch (err) {
    next(err);
  }
}

/**
 * Update low balance threshold alerts configuration.
 */
async function updateThreshold(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { low_balance_threshold } = req.body;

    const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    await wallet.update({ low_balance_threshold });
    return success(res, wallet);
  } catch (err) {
    next(err);
  }
}

/**
 * List ledger history logs.
 */
async function listTransactions(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { type, reference_type, date_from, date_to, page, limit, sort, order } = req.query;

    const results = await walletTransactionRepository.findAll({
      tenant_id: tenantId,
      type,
      reference_type,
      date_from,
      date_to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sort: sort || 'created_at',
      order: order || 'DESC',
    });

    return success(res, results);
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - view a tenant's wallet details
 */
async function getTenantWallet(req, res, next) {
  try {
    const { tenantId } = req.params;
    const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
    if (!wallet) {
      throw new NotFoundError('Wallet not found for this tenant');
    }
    return success(res, wallet);
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - manually credit tenant wallet
 */
async function manualCreditTenant(req, res, next) {
  try {
    const { tenantId } = req.params;
    const { amount, description } = req.body;
    const adminId = req.user.id; // From platformAuth middleware

    const wallet = await Wallet.findOne({ where: { tenant_id: tenantId } });
    if (!wallet) {
      throw new NotFoundError('Wallet not found for this tenant');
    }

    const newBalance = await walletService.credit(
      tenantId,
      amount,
      'manual_credit',
      null,
      description,
      adminId
    );

    return success(res, {
      new_balance: newBalance,
      message: 'Wallet credited successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWallet,
  updateThreshold,
  listTransactions,
  getTenantWallet,
  manualCreditTenant,
};
