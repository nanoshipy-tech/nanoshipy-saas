const Joi = require('joi');

const updateProfileSchema = Joi.object({
  legal_name: Joi.string().max(150).optional().allow('', null),
  gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().allow('', null).messages({
    'string.pattern.base': 'Must be a valid Indian GSTIN',
  }),
  business_type: Joi.string().valid('individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'other').optional().allow('', null),
  support_email: Joi.string().email().max(150).optional().allow('', null),
  support_phone: Joi.string().max(20).optional().allow('', null),
});

const uploadDocumentSchema = Joi.object({
  document_type: Joi.string().valid('pan', 'gst_certificate', 'address_proof', 'other').required(),
});

module.exports = {
  updateProfileSchema,
  uploadDocumentSchema,
};
