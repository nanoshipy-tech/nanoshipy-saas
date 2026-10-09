class AuthenticationError extends Error {
  constructor(message, code = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
  }
}

class ForbiddenError extends Error {
  constructor(message, code = 'FORBIDDEN') {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
  }
}

class NotFoundError extends Error {
  constructor(message, code = 'NOT_FOUND') {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
  }
}

class OrderNotShippableError extends Error {
  constructor(message = 'Order is not in a shippable state or already has a shipment') {
    super(message);
    this.name = 'OrderNotShippableError';
    this.code = 'ORDER_NOT_SHIPPABLE';
    this.statusCode = 409;
  }
}

class RateQuoteExpiredError extends Error {
  constructor(message = 'Please refresh rates before creating the shipment') {
    super(message);
    this.name = 'RateQuoteExpiredError';
    this.code = 'RATE_QUOTE_EXPIRED';
    this.statusCode = 422;
  }
}

class ProviderShipmentCreationFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderShipmentCreationFailedError';
    this.code = 'PROVIDER_SHIPMENT_CREATION_FAILED';
    this.statusCode = 502;
  }
}

class ShipmentNotCancellableError extends Error {
  constructor(message = 'Shipment cannot be cancelled in its current state') {
    super(message);
    this.name = 'ShipmentNotCancellableError';
    this.code = 'SHIPMENT_NOT_CANCELLABLE';
    this.statusCode = 409;
  }
}

class BadRequestError extends Error {
  constructor(message, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'BadRequestError';
    this.code = code;
    this.statusCode = 400;
  }
}

class InsufficientBalanceError extends Error {
  constructor(message = 'Insufficient wallet balance for this shipment rate') {
    super(message);
    this.name = 'InsufficientBalanceError';
    this.code = 'INSUFFICIENT_BALANCE';
    this.statusCode = 422;
  }
}

class PaymentSignatureInvalidError extends Error {
  constructor(message = 'Payment gateway verification signature mismatch') {
    super(message);
    this.name = 'PaymentSignatureInvalidError';
    this.code = 'PAYMENT_SIGNATURE_INVALID';
    this.statusCode = 422;
  }
}

class RechargeOrderNotFoundError extends Error {
  constructor(message = 'Recharge order record not found') {
    super(message);
    this.name = 'RechargeOrderNotFoundError';
    this.code = 'RECHARGE_ORDER_NOT_FOUND';
    this.statusCode = 404;
  }
}

class DateRangeTooLargeError extends Error {
  constructor(message = 'Requested date range exceeds the maximum limit') {
    super(message);
    this.name = 'DateRangeTooLargeError';
    this.code = 'DATE_RANGE_TOO_LARGE';
    this.statusCode = 422;
  }
}

class ExportGenerationFailedError extends Error {
  constructor(message = 'Failed to generate report export') {
    super(message);
    this.name = 'ExportGenerationFailedError';
    this.code = 'EXPORT_GENERATION_FAILED';
    this.statusCode = 500;
  }
}

class InvalidReportTypeError extends Error {
  constructor(message = 'Invalid report type requested') {
    super(message);
    this.name = 'InvalidReportTypeError';
    this.code = 'INVALID_REPORT_TYPE';
    this.statusCode = 422;
  }
}

class CrossTenantReferenceError extends Error {
  constructor(message = 'Resource cross-tenant mapping mismatch') {
    super(message);
    this.name = 'CrossTenantReferenceError';
    this.code = 'CROSS_TENANT_REFERENCE_VIOLATION';
    this.statusCode = 422;
  }
}

class TicketNotFoundError extends Error {
  constructor(message = 'Support ticket not found') {
    super(message);
    this.name = 'TicketNotFoundError';
    this.code = 'TICKET_NOT_FOUND';
    this.statusCode = 404;
  }
}

class TicketClosedError extends Error {
  constructor(message = 'Ticket is closed') {
    super(message);
    this.name = 'TicketClosedError';
    this.code = 'TICKET_CLOSED';
    this.statusCode = 422;
  }
}

class TicketNotResolvedError extends Error {
  constructor(message = 'Ticket is not resolved') {
    super(message);
    this.name = 'TicketNotResolvedError';
    this.code = 'TICKET_NOT_RESOLVED';
    this.statusCode = 409;
  }
}

// Module 18 — Settings & Activity Log errors
class SettingNotFoundError extends Error {
  constructor(message = 'Setting not found') {
    super(message);
    this.name = 'SettingNotFoundError';
    this.code = 'SETTING_NOT_FOUND';
    this.statusCode = 404;
  }
}

class InvalidSettingValueError extends Error {
  constructor(message = 'Invalid setting value') {
    super(message);
    this.name = 'InvalidSettingValueError';
    this.code = 'INVALID_SETTING_VALUE';
    this.statusCode = 422;
  }
}

class SettingsExportFailedError extends Error {
  constructor(message = 'Failed to generate settings/activity log export') {
    super(message);
    this.name = 'SettingsExportFailedError';
    this.code = 'SETTINGS_EXPORT_FAILED';
    this.statusCode = 500;
  }
}

class KycAlreadyApprovedError extends Error {
  constructor(message = 'KYC is already approved or suspended') {
    super(message);
    this.name = 'KycAlreadyApprovedError';
    this.code = 'KYC_ALREADY_APPROVED';
    this.statusCode = 409;
  }
}

class KycDocumentMissingError extends Error {
  constructor(message = 'Mandatory KYC documents are missing') {
    super(message);
    this.name = 'KycDocumentMissingError';
    this.code = 'KYC_DOCUMENT_MISSING';
    this.statusCode = 422;
  }
}

class ApiKeyRevokedException extends Error {
  constructor(message = 'API key has been revoked') {
    super(message);
    this.name = 'ApiKeyRevokedException';
    this.code = 'API_KEY_REVOKED';
    this.statusCode = 401;
  }
}

class ApiKeyScopeError extends Error {
  constructor(message = 'Insufficient scope for this operation') {
    super(message);
    this.name = 'ApiKeyScopeError';
    this.code = 'API_KEY_SCOPE_ERROR';
    this.statusCode = 403;
  }
}

class SandboxOnlyOperationError extends Error {
  constructor(message = 'This endpoint is sandbox-only') {
    super(message);
    this.name = 'SandboxOnlyOperationError';
    this.code = 'SANDBOX_ONLY_OPERATION';
    this.statusCode = 400;
  }
}

class MaxApiKeysReachedError extends Error {
  constructor(message = 'Maximum active API keys limit reached') {
    super(message);
    this.name = 'MaxApiKeysReachedError';
    this.code = 'MAX_API_KEYS_REACHED';
    this.statusCode = 409;
  }
}

class WebhookUrlInsecureError extends Error {
  constructor(message = 'Webhook URL must use HTTPS in production') {
    super(message);
    this.name = 'WebhookUrlInsecureError';
    this.code = 'WEBHOOK_URL_INSECURE';
    this.statusCode = 422;
  }
}

class TemplateNotApprovedError extends Error {
  constructor(message = 'Template is not approved') {
    super(message);
    this.name = 'TemplateNotApprovedError';
    this.code = 'TEMPLATE_NOT_APPROVED';
    this.statusCode = 422;
  }
}

class InviteTokenExpiredError extends Error {
  constructor(message = 'Sub-user invitation token has expired') {
    super(message);
    this.name = 'InviteTokenExpiredError';
    this.code = 'INVITE_TOKEN_EXPIRED';
    this.statusCode = 410;
  }
}

class DisputeWindowExpiredError extends Error {
  constructor(message = 'Weight dispute filing window has expired') {
    super(message);
    this.name = 'DisputeWindowExpiredError';
    this.code = 'DISPUTE_WINDOW_EXPIRED';
    this.statusCode = 409;
  }
}

class CodRemittanceBalanceMismatchError extends Error {
  constructor(message = 'Gross amount minus fee does not equal net amount') {
    super(message);
    this.name = 'CodRemittanceBalanceMismatchError';
    this.code = 'COD_REMITTANCE_BALANCE_MISMATCH';
    this.statusCode = 422;
  }
}

class TicketAlreadyClosedError extends Error {
  constructor(message = 'Cannot reply to a closed ticket') {
    super(message);
    this.name = 'TicketAlreadyClosedError';
    this.code = 'TICKET_ALREADY_CLOSED';
    this.statusCode = 409;
  }
}

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
    this.details = details;
  }
}

module.exports = {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  OrderNotShippableError,
  RateQuoteExpiredError,
  ProviderShipmentCreationFailedError,
  ShipmentNotCancellableError,
  BadRequestError,
  InsufficientBalanceError,
  PaymentSignatureInvalidError,
  RechargeOrderNotFoundError,
  DateRangeTooLargeError,
  ExportGenerationFailedError,
  InvalidReportTypeError,
  CrossTenantReferenceError,
  TicketNotFoundError,
  TicketClosedError,
  TicketNotResolvedError,
  SettingNotFoundError,
  InvalidSettingValueError,
  SettingsExportFailedError,
  KycAlreadyApprovedError,
  KycDocumentMissingError,
  ApiKeyRevokedException,
  ApiKeyScopeError,
  SandboxOnlyOperationError,
  MaxApiKeysReachedError,
  WebhookUrlInsecureError,
  TemplateNotApprovedError,
  InviteTokenExpiredError,
  DisputeWindowExpiredError,
  CodRemittanceBalanceMismatchError,
  TicketAlreadyClosedError,
};



