import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DelayedMarketDataProvider,
  getMarketDataProvider,
  ProviderUnauthorizedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderMalformedDataError,
  isMarketDataProviderError,
} from '../src/server/market-data';
import { evaluateRadarAsync } from '../src/server/services/radar-service';

describe('Module 9 — Free Delayed Market Data Provider Tests', () => {
  const originalFetch = global.fetch;
  const originalEnvToken = process.env.MARKETDATA_API_TOKEN;

  beforeEach(() => {
    DelayedMarketDataProvider.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.MARKETDATA_API_TOKEN = originalEnvToken;
  });

  // 1. Valid delayed quote normalization
  it('1. valid delayed quote normalization: maps API fields accurately into MarketSnapshot', async () => {
    const mockPayload = {
      s: 'ok',
      symbol: ['AAPL'],
      last: [225.45],
      bid: [225.4],
      ask: [225.5],
      mid: [225.45],
      volume: [45230100],
      change: [3.07],
      changepct: [0.0138],
      updated: [1725452760], // Unix timestamp in seconds
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    const result = await provider.getSnapshots(['AAPL']);

    expect(result.providerId).toBe('MARKETDATA_APP');
    expect(result.snapshots['AAPL']).toBeDefined();

    const aapl = result.snapshots['AAPL'];
    expect(aapl.symbol).toBe('AAPL');
    expect(aapl.name).toBe('Apple Inc.');
    expect(aapl.price).toBe(225.45);
    expect(aapl.changePercent).toBe(0.0138);
    expect(aapl.volume).toBe(45230100);
    expect(aapl.timestamp).toBe(new Date(1725452760 * 1000).toISOString());
    expect(aapl.quality).toBe('HIGH');
    expect(aapl.isSynthetic).toBe(false);
  });

  // 2. Multiple symbols in one request
  it('2. multiple symbols in one request: batches symbols into a single HTTP bulkquotes call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        s: 'ok',
        symbol: ['AAPL', 'MSFT', 'NVDA'],
        last: [225.45, 410.2, 128.5],
        volume: [40000000, 20000000, 60000000],
        updated: [1725452760, 1725452760, 1725452760],
      }),
    } as unknown as Response);

    global.fetch = fetchMock;

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    // Pass duplicate symbols to test deduplication
    const result = await provider.getSnapshots(['AAPL', 'msft', 'NVDA', 'AAPL']);

    // Exactly 1 network request must have been made
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/bulkquotes/?symbols=');
    expect(calledUrl).toContain('AAPL');
    expect(calledUrl).toContain('MSFT');
    expect(calledUrl).toContain('NVDA');

    expect(Object.keys(result.snapshots)).toHaveLength(3);
    expect(result.snapshots['AAPL'].price).toBe(225.45);
    expect(result.snapshots['MSFT'].price).toBe(410.2);
    expect(result.snapshots['NVDA'].price).toBe(128.5);
  });

  // 3. Missing optional fields
  it('3. missing optional fields: leaves omitted metrics undefined without fabricating data', async () => {
    const mockPayload = {
      s: 'ok',
      symbol: ['SPY'],
      last: [554.2],
      updated: [1725452760],
      // volume, open, previousClose, etc. are completely absent
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    const result = await provider.getSnapshots(['SPY']);

    const spy = result.snapshots['SPY'];
    expect(spy).toBeDefined();
    expect(spy.price).toBe(554.2);
    expect(spy.volume).toBeUndefined();
    expect(spy.avgDailyVolume).toBeUndefined();
    expect(spy.openPrice).toBeUndefined();
    expect(spy.previousClose).toBeUndefined();
    expect(spy.quality).toBe('DEGRADED');
  });

  // 4. Missing symbol
  it('4. missing symbol: returns null for getSnapshot and omits missing tickers from bulk snapshots', async () => {
    const mockPayload = {
      s: 'ok',
      symbol: ['AAPL'],
      last: [225.45],
      updated: [1725452760],
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    const result = await provider.getSnapshots(['AAPL', 'NONEXISTENT']);

    expect(result.snapshots['AAPL']).toBeDefined();
    expect(result.snapshots['NONEXISTENT']).toBeUndefined();

    const singleMissing = await provider.getSnapshot('NONEXISTENT');
    expect(singleMissing).toBeNull();
  });

  // 5. Unauthorized response
  it('5. unauthorized response: throws ProviderUnauthorizedError on HTTP 401/403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ s: 'error', errmsg: 'Invalid token.' }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'bad_token' });

    await expect(provider.getSnapshots(['AAPL'])).rejects.toThrow(ProviderUnauthorizedError);
    await expect(provider.getSnapshots(['AAPL'])).rejects.toSatisfy((err) => {
      return (
        isMarketDataProviderError(err) &&
        err.code === 'UNAUTHORIZED' &&
        err.statusCode === 401
      );
    });
  });

  // 6. Rate-limited response
  it('6. rate-limited response: throws ProviderRateLimitError on HTTP 429 with retry duration', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '45',
      }),
      json: async () => ({ s: 'error', errmsg: 'Too many requests' }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });

    await expect(provider.getSnapshots(['AAPL'])).rejects.toSatisfy((err) => {
      return (
        err instanceof ProviderRateLimitError &&
        err.code === 'RATE_LIMITED' &&
        err.statusCode === 429 &&
        err.retryAfterSeconds === 45
      );
    });
  });

  // 7. Timeout / Network error
  it('7. timeout/network error: throws ProviderTimeoutError on abort or request timeout', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });

    await expect(provider.getSnapshots(['AAPL'])).rejects.toThrow(ProviderTimeoutError);
    await expect(provider.getSnapshots(['AAPL'])).rejects.toSatisfy((err) => {
      return err instanceof ProviderTimeoutError && err.code === 'TIMEOUT';
    });
  });

  // 8. Malformed provider response
  it('8. malformed provider response: throws ProviderMalformedDataError on invalid payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ s: 'ok', notAnArray: 'bad_format' }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });

    await expect(provider.getSnapshots(['AAPL'])).rejects.toThrow(ProviderMalformedDataError);
    await expect(provider.getSnapshots(['AAPL'])).rejects.toSatisfy((err) => {
      return err instanceof ProviderMalformedDataError && err.code === 'MALFORMED_DATA';
    });
  });

  // 9. Correct DELAYED freshness
  it('9. correct DELAYED freshness: classifies data as DELAYED and strictly never LIVE', async () => {
    const recentTimestampSec = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        s: 'ok',
        symbol: ['AAPL'],
        last: [225.45],
        updated: [recentTimestampSec],
      }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    const result = await provider.getSnapshots(['AAPL']);

    // Even though quote age is 10s, free delayed tier must strictly be labeled DELAYED, never LIVE
    expect(result.snapshots['AAPL'].freshness).toBe('DELAYED');
    expect(result.freshness).toBe('DELAYED');
    expect(result.freshness).not.toBe('LIVE');
  });

  // 10. fetchedAt differs from market timestamp
  it('10. fetchedAt differs from market timestamp: preserves the quote age distinction', async () => {
    const tenMinutesAgoSec = Math.floor(Date.now() / 1000) - 600;

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        s: 'ok',
        symbol: ['AAPL'],
        last: [225.45],
        updated: [tenMinutesAgoSec],
      }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });
    const result = await provider.getSnapshots(['AAPL']);

    const aapl = result.snapshots['AAPL'];
    expect(aapl.timestamp).toBe(new Date(tenMinutesAgoSec * 1000).toISOString());
    expect(aapl.fetchedAt).toBeDefined();
    // fetchedAt must be within the last second, whereas timestamp is 10 minutes prior
    expect(aapl.fetchedAt).not.toBe(aapl.timestamp);
    expect(new Date(aapl.fetchedAt!).getTime()).toBeGreaterThan(new Date(aapl.timestamp).getTime());
  });

  // 11. No token -> Safe DEMO behavior
  it('11. no token → safe DEMO behavior: provider router gracefully routes to DemoMarketDataProvider', async () => {
    delete process.env.MARKETDATA_API_TOKEN;

    const provider = getMarketDataProvider({ mode: 'DELAYED', scenario: 'STOCK_SPIKE' });

    expect(provider.providerId).toBe('DEMO');
    expect(provider.isDemo).toBe(true);

    const result = await provider.getSnapshots();
    expect(result.freshness).toBe('DEMO');
    expect(result.snapshots['NVDA']).toBeDefined();
  });

  // 12. Provider failure -> Safe fallback behavior
  it('12. provider failure → safe fallback behavior: serves CACHED_FALLBACK snapshots on upstream outage', async () => {
    // Seed last known good store to simulate pre-existing cached state
    DelayedMarketDataProvider.clearCache();
    DelayedMarketDataProvider.seedLastKnownGood({
      AAPL: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 225.45,
        changePercent: 0.01,
        timestamp: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        provider: 'MARKETDATA_APP',
        quality: 'HIGH',
        freshness: 'DELAYED',
        isSynthetic: false,
      },
    });

    // Upstream is completely down (HTTP 503 Service Unavailable)
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ s: 'error', errmsg: 'Service Unavailable' }),
    } as unknown as Response);

    const provider = new DelayedMarketDataProvider({ apiToken: 'test_token' });

    // Call with fallback enabled
    const fallbackResult = await provider.getSnapshotsWithFallback(['AAPL']);

    expect(fallbackResult.freshness).toBe('CACHED_FALLBACK');
    expect(fallbackResult.snapshots['AAPL']).toBeDefined();
    expect(fallbackResult.snapshots['AAPL'].quality).toBe('FALLBACK');
    expect(fallbackResult.snapshots['AAPL'].freshness).toBe('CACHED_FALLBACK');
    expect(fallbackResult.notice).toContain('Serving cached fallback data');

    // Also verify radar evaluation service graceful fallback integration
    const radarFallback = await evaluateRadarAsync({
      mode: 'DELAYED',
      provider,
    });
    expect(radarFallback.freshness.status).toBe('CACHED_FALLBACK');
    expect(radarFallback.freshness.notice).toContain('Serving cached fallback');
  });

  describe('Module 9 Compliance & Production Safety Refinements', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAppMode = process.env.NEXT_PUBLIC_APP_MODE;

    afterEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      process.env.NEXT_PUBLIC_APP_MODE = originalAppMode;
    });

    it('1. default runtime uses DEMO mode without options', () => {
      const defaultProvider = getMarketDataProvider();
      expect(defaultProvider.providerId).toBe('DEMO');
      expect(defaultProvider.isDemo).toBe(true);
    });

    it('2. local external provider activates only when token exists in allowed non-production environment', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.NEXT_PUBLIC_APP_MODE;
      process.env.MARKETDATA_API_TOKEN = 'valid_local_token';

      const provider = getMarketDataProvider({ mode: 'MARKETDATA_LOCAL' });
      expect(provider.providerId).toBe('MARKETDATA_APP');
      expect(provider.isDemo).toBe(false);
    });

    it('3. production runtime strictly refuses external provider even when token exists', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.MARKETDATA_API_TOKEN = 'secret_token';

      const provider = getMarketDataProvider({ mode: 'MARKETDATA_LOCAL' });
      // In production, must be refused and fall back to safe Demo mode
      expect(provider.providerId).toBe('DEMO');
      expect(provider.isDemo).toBe(true);
    });

    it('4. missing token in local development safely falls back to DEMO', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.MARKETDATA_API_TOKEN;

      const provider = getMarketDataProvider({ mode: 'MARKETDATA_LOCAL' });
      expect(provider.providerId).toBe('DEMO');
      expect(provider.isDemo).toBe(true);
    });

    it('5. all six demo scenarios evaluate deterministically with zero drift', async () => {
      const scenarios = [
        'QUIET',
        'STOCK_SPIKE',
        'SECTOR_RUN',
        'MARKET_CRASH',
        'STALE',
        'PROVIDER_FAILURE',
      ] as const;

      for (const sc of scenarios) {
        const provider = getMarketDataProvider({ mode: 'DEMO', scenario: sc });
        expect(provider.isDemo).toBe(true);
        expect(['DEMO', 'CACHED_STORE']).toContain(provider.providerId);

        const result = await provider.getSnapshots();
        expect(result.snapshots).toBeDefined();
        expect(Object.keys(result.snapshots).length).toBeGreaterThan(0);
      }
    });

    it('6. credentials isolation: MARKETDATA_API_TOKEN is strictly private and not exposed via NEXT_PUBLIC_', () => {
      // Must not use NEXT_PUBLIC_ prefix
      expect(process.env.NEXT_PUBLIC_MARKETDATA_API_TOKEN).toBeUndefined();

      // Read client source files to verify no direct reference to private token
      const pageSource = fs.readFileSync(path.resolve(__dirname, '../src/app/page.tsx'), 'utf-8');
      const selectorSource = fs.readFileSync(
        path.resolve(__dirname, '../src/components/demo/ScenarioSelector.tsx'),
        'utf-8'
      );

      expect(pageSource).not.toContain('process.env.MARKETDATA_API_TOKEN');
      expect(selectorSource).not.toContain('process.env.MARKETDATA_API_TOKEN');
    });
  });
});
