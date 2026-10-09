const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(error);
  }
  req.body = value;
  next();
};

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const schemas = {
  register: Joi.object({
    company_name: Joi.string().min(2).max(150).required(),
    subdomain: Joi.string().pattern(/^[a-z0-9-]{3,63}$/).invalid('www', 'api', 'admin', 'app').optional().allow('', null),
    name: Joi.string().max(100).required(),
    email: Joi.string().email().max(150).required(),
    password: Joi.string().pattern(passwordPattern).required().messages({
      'string.pattern.base': 'Password must be at least 8 characters, contain 1 uppercase, 1 number, and 1 special character.',
    }),
    phone: Joi.string().pattern(/^\+?[0-9\s-]{8,20}$/).optional().allow('', null).messages({
      'string.pattern.base': 'Phone number must be a valid phone format.',
    }),
    otp: Joi.string().min(4).max(10).optional().allow('', null),
  }),

  verifyEmail: Joi.object({
    token: Joi.string().required(),
  }),

  login: Joi.object({
    email: Joi.string().email().optional().allow('', null),
    phone: Joi.string().optional().allow('', null),
    password: Joi.string().optional().allow('', null),
    otp: Joi.string().min(4).max(6).optional().allow('', null),
    subdomain: Joi.string().optional().allow('', null),
  }).or('email', 'phone'),

  sendLoginOtp: Joi.object({
    phone: Joi.string().optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
  }).or('phone', 'email'),


  forgotPassword: Joi.object({
    email: Joi.string().email().optional().allow('', null),
    phone: Joi.string().optional().allow('', null),
    subdomain: Joi.string().optional().allow('', null),
    channel: Joi.string().valid('email', 'whatsapp', 'sms', 'all').optional().default('email'),
  }).or('email', 'phone'),

  resetPassword: Joi.object({
    token: Joi.string().optional().allow('', null),
    otp: Joi.string().length(6).optional().allow('', null),
    email: Joi.string().optional().allow('', null),
    phone: Joi.string().optional().allow('', null),
    new_password: Joi.string().pattern(passwordPattern).required().messages({
      'string.pattern.base': 'Password must be at least 8 characters, contain 1 uppercase, 1 number, and 1 special character.',
    }),
  }).or('token', 'otp'),

  confirm2FA: Joi.object({
    otp: Joi.string().length(6).required(),
  }),

  verify2FA: Joi.object({
    temp_token: Joi.string().optional(),
    pre_auth_token: Joi.string().optional(),
    otp: Joi.string().length(6).optional(),
    totp_token: Joi.string().length(6).optional(),
  }).or('temp_token', 'pre_auth_token').or('otp', 'totp_token'),
};

module.exports = {
  validate,
  schemas,
};
