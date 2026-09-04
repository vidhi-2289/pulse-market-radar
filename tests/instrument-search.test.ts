import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AlphaVantageSearchProvider,
  searchLocalCatalog,
  searchInstruments,
} from '../src/server/instruments';
import { resolveOrCreateGuestSession } from '../src/server/services/session-service';
import { addAssetToWatchlist } from '../src/server/services/watchlist-service';
import { evaluateRadar } from '../src/server/services/radar-service';
import { clearMemoryStore } from '../src/server/db/store';

describe('Module 10 — Global Instrument Search & Smart Watchlist Add Tests', () => {
  const originalFetch = global.fetch;
  const originalEnvApiKey = process.env.ALPHAVANTAGE_API_KEY;

  beforeEach(() => {
    AlphaVantageSearchProvider.clearCache();
    clearMemoryStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ALPHAVANTAGE_API_KEY = originalEnvApiKey;
  });

  // 1. Company-name search
  it('1. company-name search: returns matching instruments when queried by company name', async () => {
    const mockPayload = {
      bestMatches: [
        {
          '1. symbol': 'NVDA',
          '2. name': 'NVIDIA Corp',
          '3. type': 'Equity',
          '4. region': 'United States',
          '8. currency': 'USD',
          '9. matchScore': '0.9000',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('nvidia');

    expect(results.length).toBe(1);
    expect(results[0].symbol).toBe('NVDA');
    expect(results[0].companyName).toBe('NVIDIA Corp');
    expect(results[0].sector).toBe('Technology'); // Enriched from catalog
    expect(results[0].sectorBenchmark).toBe('XLK');
  });

  // 2. Ticker search
  it('2. ticker search: returns matching instruments when queried by ticker symbol', async () => {
    const mockPayload = {
      bestMatches: [
        {
          '1. symbol': 'AAPL',
          '2. name': 'Apple Inc',
          '3. type': 'Equity',
          '4. region': 'United States',
          '8. currency': 'USD',
          '9. matchScore': '1.0000',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('AAPL');

    expect(results.length).toBe(1);
    expect(results[0].symbol).toBe('AAPL');
    expect(results[0].companyName).toBe('Apple Inc');
    expect(results[0].assetType).toBe('Equity');
  });

  // 3. Global result normalization
  it('3. global result normalization: preserves global exchange-qualified tickers and metadata', async () => {
    const mockPayload = {
      bestMatches: [
        {
          '1. symbol': 'RELIANCE.BSE',
          '2. name': 'Reliance Industries Limited',
          '3. type': 'Equity',
          '4. region': 'India',
          '8. currency': 'INR',
          '9. matchScore': '0.9500',
        },
        {
          '1. symbol': 'NVDA.FRK',
          '2. name': 'Nvidia Corp',
          '3. type': 'Equity',
          '4. region': 'Frankfurt',
          '8. currency': 'EUR',
          '9. matchScore': '0.8500',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockPayload,
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('reliance');

    expect(results.length).toBe(2);
    expect(results[0].symbol).toBe('RELIANCE.BSE');
    expect(results[0].companyName).toBe('Reliance Industries Limited');
    expect(results[0].exchange).toBe('BSE');
    expect(results[0].currency).toBe('INR');
    expect(results[0].region).toBe('India');

    expect(results[1].symbol).toBe('NVDA.FRK');
    expect(results[1].exchange).toBe('Frankfurt');
    expect(results[1].currency).toBe('EUR');
  });

  // 4. Empty results
  it('4. empty results: returns clean empty array when upstream returns no matches', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ bestMatches: [] }),
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('nonexistentticker999');

    expect(results).toEqual([]);
  });

  // 5. Malformed provider response
  it('5. malformed provider response: falls back gracefully to local catalog without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => 'not an object',
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    // "apple" matches local catalog
    const results = await provider.search('apple');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('AAPL');
  });

  // 6. Upstream error
  it('6. upstream error: handles API error message by falling back to local catalog', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ 'Error Message': 'Invalid API call. Check keywords parameter.' }),
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('microsoft');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('MSFT');
  });

  // 7. Rate-limit handling
  it('7. rate-limit handling: gracefully handles Alpha Vantage call limit notices via local catalog fallback', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.',
      }),
    } as unknown as Response);

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const results = await provider.search('tesla');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('TSLA');
  });

  // 8. Caching repeated queries
  it('8. caching repeated queries: serves subsequent identical queries from memory cache without network call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        bestMatches: [
          {
            '1. symbol': 'AMZN',
            '2. name': 'Amazon.com Inc',
            '3. type': 'Equity',
            '4. region': 'United States',
            '8. currency': 'USD',
            '9. matchScore': '1.0000',
          },
        ],
      }),
    } as unknown as Response);

    global.fetch = fetchMock;

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });

    // First call: calls fetch
    const res1 = await provider.search('amazon');
    expect(res1[0].symbol).toBe('AMZN');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: serves from cache
    const res2 = await provider.search('amazon');
    expect(res2[0].symbol).toBe('AMZN');
    expect(fetchMock).toHaveBeenCalledTimes(1); // Not called again
  });

  // 9. Minimum query length
  it('9. minimum query length: rejects queries under 2 characters returning empty array without network call', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const provider = new AlphaVantageSearchProvider({ apiKey: 'test_key' });
    const resEmpty = await provider.search('');
    const resSingle = await provider.search('a');

    expect(resEmpty).toEqual([]);
    expect(resSingle).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 10. Fallback when API key missing
  it('10. fallback when API key missing: searches smart local catalog seamlessly', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    // 1. Direct local catalog utility test
    const localDirect = searchLocalCatalog('appl');
    expect(localDirect.length).toBeGreaterThan(0);
    expect(localDirect[0].symbol).toBe('AAPL');

    // 2. High-level searchInstruments helper without API key
    delete process.env.ALPHAVANTAGE_API_KEY;
    const searchRes = await searchInstruments('micro');
    expect(searchRes.source).toBe('LOCAL_CATALOG');
    expect(searchRes.results.some((r) => r.symbol === 'MSFT')).toBe(true);

    // 3. Provider without API key
    const provider = new AlphaVantageSearchProvider({ apiKey: '' });
    const results = await provider.search('nvi');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('NVDA');
    expect(results[0].companyName).toBe('NVIDIA Corporation');
    expect(results[0].exchange).toBe('NASDAQ');
    expect(results[0].sector).toBe('Technology');
  });

  // 11. Selected instrument successfully enters watchlist
  it('11. selected instrument successfully enters watchlist: persists company name, exchange, and sector', async () => {
    const session = await resolveOrCreateGuestSession(null);

    // Add global instrument with metadata
    const updated = await addAssetToWatchlist(session.watchlist, {
      symbol: 'RELIANCE.BSE',
      name: 'Reliance Industries Limited',
      exchange: 'BSE',
      sector: 'Energy',
      sectorEtf: 'XLE',
    });

    const added = updated.items.find((i) => i.symbol === 'RELIANCE.BSE');
    expect(added).toBeDefined();
    expect(added?.name).toBe('Reliance Industries Limited');
    expect(added?.exchange).toBe('BSE');
    expect(added?.sector).toBe('Energy');
    expect(added?.sectorEtf).toBe('XLE');
  });

  // 12. Unsupported market symbol does not crash Demo Mode
  it('12. unsupported market symbol does not crash Demo Mode: radar evaluates cleanly with neutral baselines', () => {
    const customItems = [
      { symbol: 'RELIANCE.BSE', name: 'Reliance Industries', sector: 'Energy', sectorEtf: 'XLE', displayOrder: 1 },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', sectorEtf: 'XLK', displayOrder: 2 },
    ];

    expect(() => {
      const res = evaluateRadar({
        scenario: 'STOCK_SPIKE',
        watchlistItems: customItems,
      });

      expect(res.items.length).toBe(2);
      const reliance = res.items.find((i) => i.symbol === 'RELIANCE.BSE');
      expect(reliance).toBeDefined();
      expect(reliance?.severity).toBe('NOMINAL');
      expect(reliance?.attentionScore).toBeLessThan(30);

      const nvda = res.items.find((i) => i.symbol === 'NVDA');
      expect(nvda).toBeDefined();
      expect(nvda?.severity).toBe('CRITICAL');
    }).not.toThrow();
  });

  // 13. Security check: API key isolation
  it('13. security check: ALPHAVANTAGE_API_KEY is not exposed in public prefixes', () => {
    expect(process.env.NEXT_PUBLIC_ALPHAVANTAGE_API_KEY).toBeUndefined();
  });
});
