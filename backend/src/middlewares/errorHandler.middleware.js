const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { AuthError, ConflictError } = require('../services/auth.service');
const {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  OrderNotShippableError,
  RateQuoteExpiredError,
  ProviderShipmentCreationFailedError,
  ShipmentNotCancellableError,
  BadRequestError,
  ValidationError: AppValidationError,
} = require('../utils/errors');
const { ValidationError: JoiValidationError } = require('joi');
const { ProviderNotFoundError, ProviderCredentialsInvalidError, ProviderUnhealthyError } = require('../providers/errors');

const errorHandler = (err, req, res, next) => {
  logger.error(`[ErrorHandler] ${err.name}: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (
    err instanceof OrderNotShippableError ||
    err instanceof RateQuoteExpiredError ||
    err instanceof ProviderShipmentCreationFailedError ||
    err instanceof ShipmentNotCancellableError ||
    err instanceof BadRequestError
  ) {
    return error(res, { code: err.code, message: err.message }, err.statusCode);
  }

  if (err instanceof ProviderNotFoundError) {
    return error(res, { code: err.code, message: err.message }, 404);
  }

  if (err instanceof ProviderCredentialsInvalidError) {
    return error(res, { code: err.code, message: err.message }, 422);
  }

  if (err instanceof ProviderUnhealthyError) {
    return error(res, { code: err.code, message: err.message }, 503);
  }

  if (err instanceof AuthError || err instanceof AuthenticationError) {
    return error(res, { code: err.code || 'UNAUTHORIZED', message: err.message }, 401);
  }

  if (err instanceof ForbiddenError) {
    return error(res, { code: err.code, message: err.message }, 403);
  }

  if (err instanceof NotFoundError) {
    return error(res, { code: err.code, message: err.message }, 404);
  }

  if (err instanceof ConflictError) {
    return error(res, { code: err.code, message: err.message }, 409);
  }

  if (err instanceof JoiValidationError) {
    const fields = {};
    if (Array.isArray(err.details)) {
      err.details.forEach((detail) => {
        fields[detail.path.join('.')] = detail.message;
      });
    }
    return error(res, { code: 'VALIDATION_ERROR', message: 'Invalid input', fields }, 422);
  }

  if (err instanceof AppValidationError || err.name === 'ValidationError') {
    return error(res, { code: err.code || 'VALIDATION_ERROR', message: err.message, fields: err.details || {} }, err.statusCode || 400);
  }

  // Handle Sequelize Unique Constraint Errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return error(res, { code: 'CONFLICT', message: 'Resource already exists' }, 409);
  }

  // Catch all domain errors with custom statusCode (e.g. TicketNotResolvedError, TicketClosedError, etc.)
  if (err.statusCode) {
    return error(res, { code: err.code || 'BAD_REQUEST', message: err.message }, err.statusCode);
  }

  // Generic 500
  return error(res, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, 500);
};

module.exports = errorHandler;
