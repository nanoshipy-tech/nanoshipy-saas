'use strict';

const Joi = require('joi');

const bulkExportSchema = Joi.object({
  invoice_ids: Joi.array().items(Joi.string().uuid().required()).min(1).required(),
});

module.exports = {
  bulkExportSchema,
};
