const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(error);
  }
  req.body = value;
  next();
};

const loginSchema = Joi.object({
  email: Joi.string().email().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  password: Joi.string().optional().allow('', null),
  otp: Joi.string().min(4).max(6).optional().allow('', null),
}).or('email', 'phone');

const verify2FASchema = Joi.object({
  token: Joi.string().length(6).required(),
});

const impersonateSchema = Joi.object({
  reason: Joi.string().min(10).max(255).required(),
});

module.exports = {
  validateLogin: validate(loginSchema),
  validateVerify2FA: validate(verify2FASchema),
  validateImpersonate: validate(impersonateSchema),
};
