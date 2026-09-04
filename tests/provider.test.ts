import { describe, it, expect } from 'vitest';
import {
  IMarketDataProvider,
  DemoMarketDataProvider,
  getMarketDataProvider,
  classifyFreshness,
  FRESHNESS_THRESHOLDS,
  MarketDataProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderMalformedDataError,
  isMarketDataProviderError,
} from '../src/server/market-data';
import {
  calculateVolumeRatio,
  calculateGapPercent,
  calculateRelativeReturn,
  evaluateRadarItem,
} from '../src/server/engine/change-engine';
import {
  evaluateRadar,
  evaluateRadarAsync,
} from '../src/server/services/radar-service';
import { DemoScenario, MarketSnapshot } from '../src/types';

describe('Market Data Provider Abstraction & Freshness Contract Tests', () => {
  describe('1. IMarketDataProvider Contract & Demo Implementation', () => {
    it('DemoMarketDataProvider implements IMarketDataProvider with normalized outputs', async () => {
      const provider: IMarketDataProvider = new DemoMarketDataProvider('STOCK_SPIKE');

      expect(provider.providerId).toBe('DEMO');
      expect(provider.isDemo).toBe(true);

      // Synchronous contract
      const syncResult = provider.getSnapshotsSync!();
      expect(syncResult.freshness).toBe('DEMO');
      expect(syncResult.providerId).toBe('DEMO');
      expect(syncResult.fetchedAt).toBeDefined();
      expect(syncResult.snapshots['NVDA']).toBeDefined();

      // Normalized MarketSnapshot structure
      const nvda = syncResult.snapshots['NVDA'];
      expect(nvda.symbol).toBe('NVDA');
      expect(typeof nvda.price).toBe('number');
      expect(typeof nvda.timestamp).toBe('string');
      expect(typeof nvda.fetchedAt).toBe('string');
      expect(nvda.freshness).toBe('DEMO');
      expect(nvda.isSynthetic).toBe(true);

      // Async contract
      const asyncResult = await provider.getSnapshots();
      expect(asyncResult.snapshots['NVDA'].price).toBe(nvda.price);

      // Single snapshot lookup
      const single = await provider.getSnapshot('AAPL');
      expect(single).toBeDefined();
      expect(single?.symbol).toBe('AAPL');
    });

    it('All 6 demo scenarios conform to the provider contract', () => {
      const scenarios: DemoScenario[] = [
        'QUIET',
        'STOCK_SPIKE',
        'SECTOR_RUN',
        'MARKET_CRASH',
        'STALE',
        'PROVIDER_FAILURE',
      ];

      scenarios.forEach((scenario) => {
        const provider = getMarketDataProvider({ scenario });
        const result = provider.getSnapshotsSync!();

        expect(result.snapshots).toBeDefined();
        expect(Object.keys(result.snapshots).length).toBeGreaterThanOrEqual(8);
        expect(result.fetchedAt).toBeDefined();

        if (scenario === 'STALE') {
          expect(result.freshness).toBe('STALE');
        } else if (scenario === 'PROVIDER_FAILURE') {
          expect(result.freshness).toBe('CACHED_FALLBACK');
          expect(provider.providerId).toBe('CACHED_STORE');
        } else {
          expect(result.freshness).toBe('DEMO');
        }
      });
    });

    it('Provider Router returns DemoMarketDataProvider by default', () => {
      const routerProvider = getMarketDataProvider();
      expect(routerProvider.providerId).toBe('DEMO');
      expect(routerProvider.isDemo).toBe(true);
    });
  });

  describe('2. Freshness Classification Contract', () => {
    const fixedNow = new Date('2026-09-04T12:00:00.000Z');

    it('Classifies synthetic data unconditionally as DEMO', () => {
      const status = classifyFreshness({
        marketTimestamp: '2026-09-04T11:59:50.000Z', // 10s old
        isSynthetic: true,
        now: fixedNow,
      });
      expect(status).toBe('DEMO');
    });

    it('Classifies cached fallback unconditionally as CACHED_FALLBACK', () => {
      const status = classifyFreshness({
        marketTimestamp: '2026-09-04T11:59:50.000Z',
        isCachedFallback: true,
        now: fixedNow,
      });
      expect(status).toBe('CACHED_FALLBACK');
    });

    it('Classifies <= 60 seconds as LIVE', () => {
      // 15 seconds old
      const status15s = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - 15 * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status15s).toBe('LIVE');

      // Exactly 60 seconds old
      const status60s = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_SECONDS * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status60s).toBe('LIVE');
    });

    it('Classifies 61s to 20m as DELAYED', () => {
      // 61 seconds old
      const status61s = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - 61 * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status61s).toBe('DELAYED');

      // 15 minutes old (standard exchange delay)
      const status15m = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - 15 * 60 * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status15m).toBe('DELAYED');

      // Exactly 20 minutes old
      const status20m = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - FRESHNESS_THRESHOLDS.DELAYED_MAX_AGE_SECONDS * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status20m).toBe('DELAYED');
    });

    it('Classifies > 20m as STALE', () => {
      // 21 minutes old
      const status21m = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - 21 * 60 * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status21m).toBe('STALE');

      // 48 minutes old
      const status48m = classifyFreshness({
        marketTimestamp: new Date(fixedNow.getTime() - 48 * 60 * 1000).toISOString(),
        now: fixedNow,
      });
      expect(status48m).toBe('STALE');
    });

    it('Classifies malformed timestamp safely as STALE', () => {
      const status = classifyFreshness({
        marketTimestamp: 'not-a-valid-date',
        now: fixedNow,
      });
      expect(status).toBe('STALE');
    });
  });

  describe('3. Market Timestamp vs FetchedAt Separation', () => {
    it('Preserves distinct market trade timestamp and Pulse ingest fetchedAt', () => {
      const provider = new DemoMarketDataProvider('STALE');
      const result = provider.getSnapshotsSync();

      const nvda = result.snapshots['NVDA'];
      expect(nvda).toBeDefined();

      const marketQuoteTime = new Date(nvda.timestamp).getTime();
      const pulseFetchedTime = new Date(nvda.fetchedAt).getTime();

      // Market print is 48 mins in the past
      const ageDiffMs = pulseFetchedTime - marketQuoteTime;
      expect(ageDiffMs).toBeGreaterThanOrEqual(45 * 60 * 1000);
      expect(nvda.freshness).toBe('STALE');
    });
  });

  describe('4. Optional Fields & Graceful Degradation', () => {
    it('calculateVolumeRatio degrades gracefully to 1.0 when volume or ADV is missing', () => {
      expect(calculateVolumeRatio(undefined, 1000, 5000)).toBe(1.0);
      expect(calculateVolumeRatio(null as unknown as number, 1000, 5000)).toBe(1.0);
      expect(calculateVolumeRatio(1000, undefined, undefined)).toBe(1.0);
      expect(calculateVolumeRatio(1000, 500, 0)).toBe(1.0);
      expect(calculateVolumeRatio(1000, 500, -100)).toBe(1.0);
    });

    it('calculateGapPercent degrades gracefully to 0 gap when openPrice or previousClose is missing', () => {
      expect(calculateGapPercent(undefined, 100)).toEqual({ gapPercent: 0, gapHeld: false });
      expect(calculateGapPercent(100, undefined)).toEqual({ gapPercent: 0, gapHeld: false });
      expect(calculateGapPercent(null, null)).toEqual({ gapPercent: 0, gapHeld: false });
      expect(calculateGapPercent(0, 100)).toEqual({ gapPercent: 0, gapHeld: false });
    });

    it('calculateRelativeReturn degrades gracefully when sector benchmark is missing', () => {
      // When sector benchmark is not present, idiosyncratic return compares only against broad market
      const idioWithSector = calculateRelativeReturn(0.04, 0.03, 0.01, true);
      const idioWithoutSector = calculateRelativeReturn(0.04, 0, 0.01, false);

      expect(idioWithoutSector).toBeCloseTo(0.04 - 0.01, 4); // 4% asset - 1% market = 3%
      expect(idioWithSector).not.toBe(idioWithoutSector);
    });

    it('evaluateRadarItem evaluates completely without throwing when optional fields are missing', () => {
      const minimalCurrent: MarketSnapshot = {
        symbol: 'XYZ',
        name: 'XYZ Corp',
        price: 150.0,
        changePercent: 0.02,
        timestamp: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        provider: 'MINIMAL_PROVIDER',
        freshness: 'LIVE',
        isSynthetic: false,
        // volume, avgDailyVolume, openPrice, highPrice, lowPrice, previousClose are omitted
      };

      const minimalCheckpoint: MarketSnapshot = {
        symbol: 'XYZ',
        name: 'XYZ Corp',
        price: 147.0,
        changePercent: 0,
        timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
        fetchedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        provider: 'MINIMAL_PROVIDER',
        freshness: 'LIVE',
        isSynthetic: false,
      };

      const result = evaluateRadarItem({
        item: { symbol: 'XYZ', name: 'XYZ Corp', sector: 'General', sectorEtf: 'SPY', displayOrder: 1 },
        currentSnapshot: minimalCurrent,
        checkpointSnapshot: minimalCheckpoint,
        // sectorSnapshot and marketSnapshot omitted
      });

      expect(result.symbol).toBe('XYZ');
      expect(result.currentPrice).toBe(150.0);
      expect(result.checkpointPrice).toBe(147.0);
      expect(result.volumeRatio).toBe(1.0); // Degraded to neutral
      expect(result.gapPercent).toBe(0); // Degraded to 0
      expect(result.severity).toBeDefined();
    });
  });

  describe('5. Typed Provider Failures & Resilience', () => {
    it('Creates typed provider errors with proper error codes and retryable flags', () => {
      const unavailable = new ProviderUnavailableError('TWELVE_DATA', 'Connection refused', 503);
      expect(unavailable.code).toBe('UNAVAILABLE');
      expect(unavailable.statusCode).toBe(503);
      expect(unavailable.retryable).toBe(true);
      expect(unavailable.message).toContain('[TWELVE_DATA] UNAVAILABLE: Connection refused');
      expect(isMarketDataProviderError(unavailable)).toBe(true);

      const timeout = new ProviderTimeoutError('FINNHUB');
      expect(timeout.code).toBe('TIMEOUT');
      expect(timeout.statusCode).toBe(504);
      expect(timeout.retryable).toBe(true);
      expect(isMarketDataProviderError(timeout)).toBe(true);

      const rateLimit = new ProviderRateLimitError('ALPHA_VANTAGE', 60);
      expect(rateLimit.code).toBe('RATE_LIMITED');
      expect(rateLimit.statusCode).toBe(429);
      expect(rateLimit.retryAfterSeconds).toBe(60);
      expect(rateLimit.retryable).toBe(true);

      const malformed = new ProviderMalformedDataError('CUSTOM_API', 'Invalid JSON');
      expect(malformed.code).toBe('MALFORMED_DATA');
      expect(malformed.statusCode).toBe(502);
      expect(malformed.retryable).toBe(false);

      expect(isMarketDataProviderError(new Error('Generic error'))).toBe(false);
    });

    it('Simulated provider failure can be caught gracefully without crashing', async () => {
      // Mock provider that simulates a typed failure
      class FailingProvider implements IMarketDataProvider {
        public readonly providerId = 'FAILING_MOCK';
        public readonly isDemo = false;

        async getSnapshots(): Promise<never> {
          throw new ProviderUnavailableError('FAILING_MOCK', 'Upstream 503 Service Unavailable');
        }
        async getSnapshot(): Promise<never> {
          throw new ProviderUnavailableError('FAILING_MOCK');
        }
      }

      const failingProvider = new FailingProvider();
      let caughtError: MarketDataProviderError | null = null;

      try {
        await failingProvider.getSnapshots();
      } catch (err) {
        if (isMarketDataProviderError(err)) {
          caughtError = err;
        }
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.code).toBe('UNAVAILABLE');
      expect(caughtError?.retryable).toBe(true);
    });
  });

  describe('6. Async vs Synchronous Radar Evaluation', () => {
    it('evaluateRadarAsync yields identical scores and rankings to evaluateRadar', async () => {
      const syncResult = evaluateRadar({ scenario: 'STOCK_SPIKE' });
      const asyncResult = await evaluateRadarAsync({ scenario: 'STOCK_SPIKE' });

      expect(asyncResult.summary.anomaliesDetected).toBe(syncResult.summary.anomaliesDetected);
      expect(asyncResult.items.length).toBe(syncResult.items.length);
      expect(asyncResult.items[0].symbol).toBe(syncResult.items[0].symbol);
      expect(asyncResult.items[0].attentionScore).toBe(syncResult.items[0].attentionScore);
      expect(asyncResult.freshness.status).toBe(syncResult.freshness.status);
    });
  });
});
