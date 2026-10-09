'use strict';

const Joi = require('joi');

const updateBusinessDetailsSchema = Joi.object({
  legal_business_name: Joi.string().max(255).required(),
  business_type: Joi.string().valid('proprietorship', 'partnership', 'pvt_ltd', 'llp', 'individual').required(),
  pan_number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).message('Invalid PAN format').required(),
  gst_number: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).message('Invalid GST number format').allow(null, ''),
  gst_registered: Joi.boolean().required(),
  authorized_signatory_name: Joi.string().max(255).required(),
  aadhaar_last4: Joi.string().length(4).pattern(/^[0-9]{4}$/).message('Aadhaar last 4 must be exactly 4 digits').required(),
});

const verifyBankDetailsSchema = Joi.object({
  bank_account_number: Joi.string().pattern(/^[0-9]{9,18}$/).message('Bank account must be between 9 and 18 digits').required(),
  bank_ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).message('Invalid IFSC code format').required(),
  bank_account_holder_name: Joi.string().max(255).required(),
});

const uploadDocumentSchema = Joi.object({
  document_type: Joi.string().valid('pan', 'gst_certificate', 'bank_cancelled_cheque', 'aadhaar_front', 'aadhaar_back', 'incorporation_certificate').required(),
  s3_object_key: Joi.string().max(500).required(),
});

const reviewKycSchema = Joi.object({
  reason: Joi.string().max(1000).required(),
});

module.exports = {
  updateBusinessDetailsSchema,
  verifyBankDetailsSchema,
  uploadDocumentSchema,
  reviewKycSchema,
};
