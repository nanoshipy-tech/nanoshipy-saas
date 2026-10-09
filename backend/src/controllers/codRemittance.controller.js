'use strict';

const codRemittanceService = require('../services/codRemittance.service');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const Joi = require('joi');

const createBatchSchema = Joi.object({
  seller_id: Joi.string().uuid().required(),
  shipment_ids: Joi.array().items(Joi.string().uuid()).required().min(1),
  gross_amount: Joi.number().precision(2).positive().required(),
  platform_fee: Joi.number().precision(2).min(0).required(),
  remittance_mode: Joi.string().valid('wallet_credit', 'bank_payout').required(),
});

const listBatches = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const list = await codRemittanceService.listBatches(sellerId);
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

const getBatchDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.tenant_id || req.user.id;
    const batch = await codRemittanceService.getBatchDetails(id, sellerId);
    if (!batch) throw new NotFoundError('Remittance batch not found');
    return success(res, batch);
  } catch (err) {
    next(err);
  }
};

// Admin Endpoints
const createBatchAdmin = async (req, res, next) => {
  try {
    const { error, value } = createBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }

    const batch = await codRemittanceService.createBatch(value);
    return success(res, batch, 201);
  } catch (err) {
    next(err);
  }
};

const processBatchAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const batch = await codRemittanceService.processBatch(id, adminId);
    return success(res, batch);
  } catch (err) {
    next(err);
  }
};

const listBatchesAdmin = async (req, res, next) => {
  try {
    const list = await codRemittanceService.listBatches();
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listBatches,
  getBatchDetails,
  createBatchAdmin,
  processBatchAdmin,
  listBatchesAdmin,
};
