'use strict';

class ProviderNotFoundError extends Error {
  constructor(providerKey) {
    super(`Provider "${providerKey}" not found or registry adapter class is missing.`);
    this.name = 'ProviderNotFoundError';
    this.code = 'PROVIDER_NOT_FOUND';
    this.statusCode = 404;
  }
}

class ProviderCredentialsInvalidError extends Error {
  constructor(message = 'Invalid provider credentials format or values.') {
    super(message);
    this.name = 'ProviderCredentialsInvalidError';
    this.code = 'PROVIDER_CREDENTIALS_INVALID';
    this.statusCode = 422;
  }
}

class ProviderUnhealthyError extends Error {
  constructor(providerKey, message = 'Provider health check failed pre-flight.') {
    super(`Courier provider "${providerKey}" is unhealthy: ${message}`);
    this.name = 'ProviderUnhealthyError';
    this.code = 'PROVIDER_UNHEALTHY';
    this.statusCode = 503;
  }
}

class ProviderResponseMalformedError extends Error {
  constructor(providerKey, message = 'Provider returned malformed or unexpected response format.') {
    super(`Courier provider "${providerKey}" response is malformed: ${message}`);
    this.name = 'ProviderResponseMalformedError';
    this.code = 'PROVIDER_RESPONSE_MALFORMED';
    this.statusCode = 502;
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(providerKey, message = 'Circuit breaker is OPEN. Calls are fail-fast blocked.') {
    super(`Courier provider "${providerKey}" circuit breaker is OPEN: ${message}`);
    this.name = 'CircuitBreakerOpenError';
    this.code = 'CIRCUIT_BREAKER_OPEN';
    this.statusCode = 503;
  }
}

class ConfigurationError extends Error {
  constructor(message = 'Missing required provider configuration or environment variables.') {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'CONFIGURATION_ERROR';
    this.statusCode = 500;
  }
}

class ProviderValidationError extends Error {
  constructor(message = 'Provider validation error: invalid or unmapped service type.') {
    super(message);
    this.name = 'ProviderValidationError';
    this.code = 'PROVIDER_VALIDATION_ERROR';
    this.statusCode = 400;
  }
}

module.exports = {
  ProviderNotFoundError,
  ProviderCredentialsInvalidError,
  ProviderUnhealthyError,
  ProviderResponseMalformedError,
  CircuitBreakerOpenError,
  ConfigurationError,
  ProviderValidationError,
};
