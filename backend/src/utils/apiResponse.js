/**
 * Standardized API response helpers.
 * All responses follow the shape: { success, data, error }
 */

const success = (res, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
};

const error = (res, errPayload = {}, statusCode = 500, optionalCode = null) => {
  let code = 'INTERNAL_ERROR';
  let message = 'An error occurred';
  let fields = undefined;

  if (typeof errPayload === 'string') {
    message = errPayload;
    code = optionalCode || 'ERROR';
  } else if (errPayload && typeof errPayload === 'object') {
    code = errPayload.code || optionalCode || 'INTERNAL_ERROR';
    message = errPayload.message || 'An error occurred';
    fields = errPayload.fields;
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
};

module.exports = { success, error };
