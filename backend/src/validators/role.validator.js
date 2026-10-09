const Joi = require('joi');
const { PERMISSIONS } = require('../constants/permissions.constant');

const { getAllUserPermissionKeys } = require('../constants/rbacCatalog.constant');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(error);
  }
  req.body = value;
  next();
};

const validPermissionKeys = Array.from(new Set([
  ...PERMISSIONS.map(p => p.key),
  ...getAllUserPermissionKeys(),
]));

const schemas = {
  createRole: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(255).optional().allow('', null),
    permission_keys: Joi.array().items(
      Joi.string().valid(...validPermissionKeys)
    ).required().messages({
      'any.only': 'One or more permission keys are invalid.',
    }),
  }),
  updateRole: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(255).optional().allow('', null),
    permission_keys: Joi.array().items(
      Joi.string().valid(...validPermissionKeys)
    ).required().messages({
      'any.only': 'One or more permission keys are invalid.',
    }),
  }),
};

module.exports = {
  validate,
  schemas,
};
