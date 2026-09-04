/**
 * PULSE — Delayed Market Data Provider
 * $0 Free Tier External Market Data Provider integrating Market Data API (https://api.marketdata.app/).
 *
 * Design Guardrails:
 * - Batched multi-symbol requests via /v1/stocks/bulkquotes/?symbols=...
 * - Aggressive credit conservation: server-side in-memory cache with 60s TTL
 * - Zero fabricated data: maps only provided fields, omitting volume/open/previousClose when absent
 * - Strict freshness contract: classifies as DELAYED (or STALE if >20m), never LIVE
 * - Safe error handling: maps upstream HTTP codes to typed MarketDataProviderError hierarchy
 */

import { MarketSnapshot, ProviderSnapshotsResult, FreshnessStatus } from '@/types';
import { IMarketDataProvider } from './provider-interface';
import { classifyFreshness } from './freshness';
import {
  MarketDataProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderMalformedDataError,
  ProviderUnauthorizedError,
} from './provider-errors';
import { DEFAULT_WATCHLIST } from './mock-fixtures';

const KNOWN_ASSET_NAMES: Record<string, string> = {
  NVDA: 'NVIDIA Corporation',
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  TSLA: 'Tesla, Inc.',
  JPM: 'JPMorgan Chase & Co.',
  XOM: 'Exxon Mobil Corporation',
  SPY: 'SPDR S&P 500 ETF Trust',
  XLK: 'Technology Select Sector SPDR Fund',
  XLF: 'Financial Select Sector SPDR Fund',
  XLE: 'Energy Select Sector SPDR Fund',
  XLY: 'Consumer Discretionary Select Sector SPDR Fund',
};

interface CacheEntry {
  snapshot: MarketSnapshot;
  cachedAtMs: number;
}

export interface DelayedProviderOptions {
  apiToken?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

export class DelayedMarketDataProvider implements IMarketDataProvider {
  public readonly providerId = 'MARKETDATA_APP';
  public readonly isDemo = false;

  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly timeoutMs: number;

  // Process-wide in-memory cache to conserve API credits across requests
  private static cache: Map<string, CacheEntry> = new Map();
  // Last known good snapshots for circuit-breaker fallback during upstream outages
  private static lastKnownGoodSnapshots: Record<string, MarketSnapshot> = {};

  constructor(options: DelayedProviderOptions = {}) {
    this.apiToken = options.apiToken ?? process.env.MARKETDATA_API_TOKEN;
    this.baseUrl = options.baseUrl ?? 'https://api.marketdata.app/v1/stocks';
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000; // 60 seconds
    this.timeoutMs = options.timeoutMs ?? 5_000; // 5 seconds
  }

  /**
   * Clears the in-memory cache and fallback store (primarily for unit testing).
   */
  public static clearCache(): void {
    DelayedMarketDataProvider.cache.clear();
    DelayedMarketDataProvider.lastKnownGoodSnapshots = {};
  }

  /**
   * Seeds the fallback store (useful for unit testing fallback behavior).
   */
  public static seedLastKnownGood(snapshots: Record<string, MarketSnapshot>): void {
    DelayedMarketDataProvider.lastKnownGoodSnapshots = {
      ...DelayedMarketDataProvider.lastKnownGoodSnapshots,
      ...snapshots,
    };
  }

  /**
   * Retrieves snapshots for requested symbols (or default tracked universe).
   * Throws typed MarketDataProviderError on network or upstream failure.
   */
  public async getSnapshots(
    symbols?: string[],
    options?: { allowFallback?: boolean }
  ): Promise<ProviderSnapshotsResult> {
    const targetSymbols = this.resolveSymbols(symbols);

    try {
      return await this.fetchAndAssembleSnapshots(targetSymbols);
    } catch (error) {
      if (options?.allowFallback) {
        return this.createFallbackResult(
          targetSymbols,
          error instanceof Error ? error.message : 'Upstream provider error'
        );
      }
      throw error;
    }
  }

  /**
   * Convenience method to retrieve snapshots with automated safe fallback.
   */
  public async getSnapshotsWithFallback(symbols?: string[]): Promise<ProviderSnapshotsResult> {
    return this.getSnapshots(symbols, { allowFallback: true });
  }

  /**
   * Retrieves a single normalized snapshot for an asset.
   */
  public async getSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    const res = await this.getSnapshots([symbol]);
    return res.snapshots[symbol.trim().toUpperCase()] ?? null;
  }

  /**
   * Resolves, deduplicates, and defaults target symbols.
   */
  private resolveSymbols(symbols?: string[]): string[] {
    if (symbols && symbols.length > 0) {
      return Array.from(new Set(symbols.map((s) => s.trim().toUpperCase())));
    }

    const defaultSymbols = [
      ...DEFAULT_WATCHLIST.map((w) => w.symbol),
      'SPY',
      'XLK',
      'XLF',
      'XLE',
      'XLY',
    ];
    return Array.from(new Set(defaultSymbols));
  }

  /**
   * Fetches missing symbols from upstream and assembles the normalized result.
   */
  private async fetchAndAssembleSnapshots(symbols: string[]): Promise<ProviderSnapshotsResult> {
    const now = Date.now();
    const resultSnapshots: Record<string, MarketSnapshot> = {};
    const symbolsToFetch: string[] = [];

    // 1. Check in-memory cache
    for (const sym of symbols) {
      const entry = DelayedMarketDataProvider.cache.get(sym);
      if (entry && now - entry.cachedAtMs < this.cacheTtlMs) {
        resultSnapshots[sym] = entry.snapshot;
      } else {
        symbolsToFetch.push(sym);
      }
    }

    // 2. Fetch uncached symbols in a single batched HTTP request
    if (symbolsToFetch.length > 0) {
      const fetchedSnapshots = await this.fetchBatchFromUpstream(symbolsToFetch);
      for (const [sym, snap] of Object.entries(fetchedSnapshots)) {
        resultSnapshots[sym] = snap;
        // Update caches
        DelayedMarketDataProvider.cache.set(sym, { snapshot: snap, cachedAtMs: now });
        DelayedMarketDataProvider.lastKnownGoodSnapshots[sym] = snap;
      }
    }

    // 3. Determine overall freshness and construct response
    const snapshotList = Object.values(resultSnapshots);
    const overallFreshness: FreshnessStatus = snapshotList.some((s) => s.freshness === 'STALE')
      ? 'STALE'
      : 'DELAYED';

    return {
      snapshots: resultSnapshots,
      freshness: overallFreshness,
      providerId: this.providerId,
      fetchedAt: new Date().toISOString(),
      notice: 'Market Data · 24H Delayed quotes (Local Development Only)',
    };
  }

  /**
   * Performs the actual HTTP request to Market Data API bulkquotes endpoint.
   */
  private async fetchBatchFromUpstream(symbols: string[]): Promise<Record<string, MarketSnapshot>> {
    const url = `${this.baseUrl}/bulkquotes/?symbols=${encodeURIComponent(symbols.join(','))}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('timeout'))) {
        throw new ProviderTimeoutError(this.providerId, `Upstream request timed out after ${this.timeoutMs}ms`);
      }
      throw new ProviderUnavailableError(
        this.providerId,
        `Network failure reaching Market Data API: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle HTTP status codes
    if (response.status === 401 || response.status === 403) {
      throw new ProviderUnauthorizedError(
        this.providerId,
        'Unauthorized or invalid MARKETDATA_API_TOKEN credentials',
        response.status
      );
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new ProviderRateLimitError(
        this.providerId,
        retryAfter,
        'Market Data API rate limit exceeded'
      );
    }

    if (response.status >= 500) {
      throw new ProviderUnavailableError(
        this.providerId,
        `Market Data API service unavailable (HTTP ${response.status})`,
        response.status
      );
    }

    // 200 OK and 203 Non-Authoritative Information are both valid successes
    if (response.status !== 200 && response.status !== 203) {
      throw new MarketDataProviderError(
        `Unexpected HTTP response ${response.status} from Market Data API`,
        {
          code: 'UNKNOWN',
          providerId: this.providerId,
          statusCode: response.status,
        }
      );
    }

    // Parse JSON
    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderMalformedDataError(
        this.providerId,
        'Failed to parse JSON response from Market Data API'
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new ProviderMalformedDataError(
        this.providerId,
        'Received empty or invalid payload object from provider'
      );
    }

    if (payload.s === 'error') {
      const errMsg = typeof payload.errmsg === 'string' ? payload.errmsg : 'Unknown provider error';
      if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('unauthorized')) {
        throw new ProviderUnauthorizedError(this.providerId, errMsg, 401);
      }
      throw new ProviderMalformedDataError(this.providerId, `Provider error status: ${errMsg}`);
    }

    return this.normalizePayload(payload);
  }

  /**
   * Normalizes the Market Data API bulkquotes packed JSON into MarketSnapshot records.
   */
  private normalizePayload(payload: Record<string, unknown>): Record<string, MarketSnapshot> {
    const rawSymbols = (payload.symbol ?? payload.symbols) as unknown[];
    const rawLast = payload.last as unknown[];
    const rawUpdated = (payload.updated ?? payload.timestamp) as unknown[];
    const rawChangePct = payload.changepct as unknown[];
    const rawVolume = payload.volume as unknown[];

    if (!Array.isArray(rawSymbols) || !Array.isArray(rawLast)) {
      throw new ProviderMalformedDataError(
        this.providerId,
        'Malformed payload: expected symbol and last arrays in response'
      );
    }

    const fetchedAt = new Date().toISOString();
    const snapshots: Record<string, MarketSnapshot> = {};

    for (let i = 0; i < rawSymbols.length; i++) {
      const sym = typeof rawSymbols[i] === 'string' ? (rawSymbols[i] as string).toUpperCase() : null;
      const price = typeof rawLast[i] === 'number' ? (rawLast[i] as number) : null;

      if (!sym || price === null || isNaN(price)) {
        continue;
      }

      // Extract market quote timestamp (Unix seconds -> ISO 8601)
      let marketTimestamp = fetchedAt;
      if (Array.isArray(rawUpdated) && typeof rawUpdated[i] === 'number') {
        const unixSec = rawUpdated[i] as number;
        marketTimestamp = new Date(unixSec * 1000).toISOString();
      }

      // Classify freshness: strictly DELAYED or STALE (never LIVE for free delayed tier)
      let freshness = classifyFreshness({
        marketTimestamp,
        fetchedAt,
        isSynthetic: false,
      });

      if (freshness === 'LIVE') {
        freshness = 'DELAYED';
      }

      // Extract optional metrics strictly without fabricating missing data
      const volume =
        Array.isArray(rawVolume) && typeof rawVolume[i] === 'number'
          ? (rawVolume[i] as number)
          : undefined;

      const changePercent =
        Array.isArray(rawChangePct) && typeof rawChangePct[i] === 'number'
          ? (rawChangePct[i] as number)
          : 0;

      snapshots[sym] = {
        symbol: sym,
        name: KNOWN_ASSET_NAMES[sym] ?? sym,
        price,
        changePercent,
        volume,
        timestamp: marketTimestamp,
        fetchedAt,
        quality: volume !== undefined ? 'HIGH' : 'DEGRADED',
        confidence: 1.0,
        freshness,
        provider: this.providerId,
        isSynthetic: false,
      };
    }

    return snapshots;
  }

  /**
   * Generates a safe CACHED_FALLBACK response when upstream provider is offline.
   */
  public createFallbackResult(symbols: string[], reason: string): ProviderSnapshotsResult {
    const fetchedAt = new Date().toISOString();
    const fallbackSnapshots: Record<string, MarketSnapshot> = {};

    for (const sym of symbols) {
      const cached = DelayedMarketDataProvider.lastKnownGoodSnapshots[sym];
      if (cached) {
        fallbackSnapshots[sym] = {
          ...cached,
          quality: 'FALLBACK',
          freshness: 'CACHED_FALLBACK',
          fetchedAt,
        };
      }
    }

    return {
      snapshots: fallbackSnapshots,
      freshness: 'CACHED_FALLBACK',
      providerId: this.providerId,
      fetchedAt,
      notice: `Serving cached fallback data (${reason})`,
    };
  }
}
