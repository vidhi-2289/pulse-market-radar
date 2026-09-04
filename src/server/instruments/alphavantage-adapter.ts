/**
 * PULSE — Alpha Vantage Global Instrument Search Adapter
 * Adapts Alpha Vantage SYMBOL_SEARCH into vendor-neutral InstrumentSearchResult[]
 * with server-side in-memory TTL caching and graceful fallback.
 */

import { InstrumentSearchResult } from '@/types';
import { IInstrumentSearchProvider, SearchOptions } from './instrument-interface';
import { searchLocalCatalog, enrichKnownInstrumentMetadata } from './local-catalog';
import {
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderMalformedDataError,
} from '../market-data/provider-errors';

interface CacheEntry {
  results: InstrumentSearchResult[];
  cachedAtMs: number;
}

export interface AlphaVantageAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

export class AlphaVantageSearchProvider implements IInstrumentSearchProvider {
  public readonly providerId = 'ALPHAVANTAGE';

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly timeoutMs: number;

  // Process-wide in-memory cache to conserve limited Alpha Vantage free tier requests
  private static cache = new Map<string, CacheEntry>();

  constructor(options: AlphaVantageAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ALPHAVANTAGE_API_KEY;
    this.baseUrl = options.baseUrl ?? 'https://www.alphavantage.co/query';
    this.cacheTtlMs = options.cacheTtlMs ?? 15 * 60 * 1000; // 15 minutes TTL
    this.timeoutMs = options.timeoutMs ?? 5000; // 5 seconds timeout
  }

  /**
   * Clears the in-memory cache (primarily for unit testing).
   */
  public static clearCache(): void {
    AlphaVantageSearchProvider.cache.clear();
  }

  /**
   * Searches for instruments matching the query string.
   * Returns empty array if query length is less than 2 characters.
   */
  public async search(
    rawQuery: string,
    options: SearchOptions = {}
  ): Promise<InstrumentSearchResult[]> {
    const query = rawQuery.trim();
    if (!query || query.length < 2) {
      return [];
    }

    const limit = options.limit ?? 8;
    const cacheKey = query.toLowerCase();
    const now = Date.now();

    // 1. Check in-memory TTL cache
    const cached = AlphaVantageSearchProvider.cache.get(cacheKey);
    if (cached && now - cached.cachedAtMs < this.cacheTtlMs) {
      return cached.results.slice(0, limit);
    }

    // 2. If no API key is provided, safely fall back to the smart local catalog
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      const localResults = searchLocalCatalog(query, limit);
      // Cache local results briefly to avoid repeated searches
      AlphaVantageSearchProvider.cache.set(cacheKey, {
        results: localResults,
        cachedAtMs: now,
      });
      return localResults;
    }

    // 3. Fetch from Alpha Vantage SYMBOL_SEARCH
    try {
      const results = await this.fetchFromUpstream(query);

      // Cache normalized results
      AlphaVantageSearchProvider.cache.set(cacheKey, {
        results,
        cachedAtMs: now,
      });

      return results.slice(0, limit);
    } catch (err) {
      console.warn(
        `[Pulse Instrument Search] Alpha Vantage search failed for "${query}"; falling back to local catalog:`,
        err instanceof Error ? err.message : String(err)
      );

      // On rate limit or network failure, fall back gracefully to local catalog
      const localFallback = searchLocalCatalog(query, limit);
      return localFallback;
    }
  }

  /**
   * Dispatches the HTTP request to Alpha Vantage and parses the response.
   */
  private async fetchFromUpstream(query: string): Promise<InstrumentSearchResult[]> {
    const url = `${this.baseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(
      query
    )}&apikey=${encodeURIComponent(this.apiKey!)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('timeout'))) {
        throw new ProviderTimeoutError(
          this.providerId,
          `Alpha Vantage request timed out after ${this.timeoutMs}ms`
        );
      }
      throw new ProviderUnavailableError(
        this.providerId,
        `Network failure reaching Alpha Vantage: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.providerId,
        `Alpha Vantage returned HTTP ${response.status}`,
        response.status
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderMalformedDataError(
        this.providerId,
        'Failed to parse JSON response from Alpha Vantage'
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new ProviderMalformedDataError(
        this.providerId,
        'Empty or invalid payload object received from Alpha Vantage'
      );
    }

    // Handle Alpha Vantage Rate Limits ("Note" or "Information")
    if (typeof payload.Note === 'string') {
      throw new ProviderRateLimitError(this.providerId, undefined, payload.Note);
    }
    if (typeof payload.Information === 'string') {
      throw new ProviderRateLimitError(this.providerId, undefined, payload.Information);
    }

    // Handle API Error Message
    if (typeof payload['Error Message'] === 'string') {
      throw new ProviderUnavailableError(this.providerId, payload['Error Message'] as string);
    }

    // Extract bestMatches
    const bestMatches = payload.bestMatches;
    if (!Array.isArray(bestMatches)) {
      // If bestMatches is missing entirely, check if it's an empty match structure
      return [];
    }

    return this.normalizeMatches(bestMatches);
  }

  /**
   * Normalizes Alpha Vantage raw bestMatches objects into vendor-neutral InstrumentSearchResult[].
   */
  private normalizeMatches(matches: Record<string, unknown>[]): InstrumentSearchResult[] {
    const results: InstrumentSearchResult[] = [];

    for (const raw of matches) {
      const rawSymbol = raw['1. symbol'];
      const rawName = raw['2. name'];

      if (typeof rawSymbol !== 'string' || typeof rawName !== 'string') {
        continue;
      }

      const symbol = rawSymbol.trim().toUpperCase();
      const companyName = rawName.trim();
      const assetType = typeof raw['3. type'] === 'string' ? (raw['3. type'] as string).trim() : undefined;
      const region = typeof raw['4. region'] === 'string' ? (raw['4. region'] as string).trim() : undefined;
      const currency = typeof raw['8. currency'] === 'string' ? (raw['8. currency'] as string).trim() : undefined;
      
      const rawScore = typeof raw['9. matchScore'] === 'string' ? parseFloat(raw['9. matchScore'] as string) : undefined;
      const matchScore = Number.isFinite(rawScore) ? rawScore : undefined;

      // Determine exchange name
      let exchange: string | undefined;
      if (symbol.includes('.')) {
        const suffix = symbol.split('.').pop()?.toUpperCase();
        if (suffix === 'BSE') exchange = 'BSE';
        else if (suffix === 'NSE') exchange = 'NSE';
        else if (suffix === 'LON') exchange = 'LSE';
        else if (suffix === 'TRT') exchange = 'TSX';
        else if (suffix === 'FRK') exchange = 'Frankfurt';
        else exchange = suffix;
      } else if (region === 'United States') {
        exchange = 'US Exchanges';
      } else {
        exchange = region;
      }

      // Enrich with known sector/benchmark if in our catalog
      const enriched = enrichKnownInstrumentMetadata(symbol, companyName);

      results.push({
        symbol,
        companyName,
        exchange,
        region,
        assetType,
        currency,
        matchScore,
        sector: enriched.sector,
        sectorBenchmark: enriched.sectorBenchmark,
      });
    }

    return results;
  }
}
