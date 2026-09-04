/**
 * PULSE — Market Data Provider Error Hierarchy
 * Typed error classifications for upstream provider anomalies and failures.
 */

export type ProviderErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'MALFORMED_DATA'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export class MarketDataProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly providerId: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    params: {
      code: ProviderErrorCode;
      providerId: string;
      statusCode?: number;
      retryable?: boolean;
    }
  ) {
    super(`[${params.providerId}] ${params.code}: ${message}`);
    this.name = 'MarketDataProviderError';
    this.code = params.code;
    this.providerId = params.providerId;
    this.statusCode = params.statusCode;
    this.retryable = params.retryable ?? true;
  }
}

export class ProviderUnavailableError extends MarketDataProviderError {
  constructor(providerId: string, message: string = 'Upstream market data provider unavailable', statusCode: number = 503) {
    super(message, {
      code: 'UNAVAILABLE',
      providerId,
      statusCode,
      retryable: true,
    });
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderTimeoutError extends MarketDataProviderError {
  constructor(providerId: string, message: string = 'Upstream request timed out') {
    super(message, {
      code: 'TIMEOUT',
      providerId,
      statusCode: 504,
      retryable: true,
    });
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRateLimitError extends MarketDataProviderError {
  public readonly retryAfterSeconds?: number;

  constructor(providerId: string, retryAfterSeconds?: number, message: string = 'Provider rate limit exceeded') {
    super(message, {
      code: 'RATE_LIMITED',
      providerId,
      statusCode: 429,
      retryable: true,
    });
    this.name = 'ProviderRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderMalformedDataError extends MarketDataProviderError {
  constructor(providerId: string, message: string = 'Malformed or incomplete payload received from provider') {
    super(message, {
      code: 'MALFORMED_DATA',
      providerId,
      statusCode: 502,
      retryable: false,
    });
    this.name = 'ProviderMalformedDataError';
  }
}

export class ProviderUnauthorizedError extends MarketDataProviderError {
  constructor(providerId: string, message: string = 'Unauthorized or invalid API credentials', statusCode: number = 401) {
    super(message, {
      code: 'UNAUTHORIZED',
      providerId,
      statusCode,
      retryable: false,
    });
    this.name = 'ProviderUnauthorizedError';
  }
}

export function isMarketDataProviderError(err: unknown): err is MarketDataProviderError {
  return err instanceof MarketDataProviderError;
}
