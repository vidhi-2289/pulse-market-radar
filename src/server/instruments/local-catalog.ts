/**
 * PULSE — Smart Local Instrument Catalog
 * Instant offline fallback and baseline directory for major US market securities.
 */

import { InstrumentSearchResult } from '@/types';

export const LOCAL_INSTRUMENT_CATALOG: InstrumentSearchResult[] = [
  // Mega-Cap Tech & Growth
  {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Technology',
    sectorBenchmark: 'XLK',
    matchScore: 1.0,
  },
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Technology',
    sectorBenchmark: 'XLK',
    matchScore: 1.0,
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Technology',
    sectorBenchmark: 'XLK',
    matchScore: 1.0,
  },
  {
    symbol: 'GOOGL',
    companyName: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Communication Services',
    sectorBenchmark: 'XLC',
    matchScore: 1.0,
  },
  {
    symbol: 'AMZN',
    companyName: 'Amazon.com, Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Consumer Discretionary',
    sectorBenchmark: 'XLY',
    matchScore: 1.0,
  },
  {
    symbol: 'META',
    companyName: 'Meta Platforms, Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Communication Services',
    sectorBenchmark: 'XLC',
    matchScore: 1.0,
  },
  {
    symbol: 'TSLA',
    companyName: 'Tesla, Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Consumer Discretionary',
    sectorBenchmark: 'XLY',
    matchScore: 1.0,
  },
  {
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices, Inc.',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Technology',
    sectorBenchmark: 'XLK',
    matchScore: 1.0,
  },

  // Financials
  {
    symbol: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    exchange: 'NYSE',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Financials',
    sectorBenchmark: 'XLF',
    matchScore: 1.0,
  },
  {
    symbol: 'BAC',
    companyName: 'Bank of America Corporation',
    exchange: 'NYSE',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Financials',
    sectorBenchmark: 'XLF',
    matchScore: 1.0,
  },

  // Energy
  {
    symbol: 'XOM',
    companyName: 'Exxon Mobil Corporation',
    exchange: 'NYSE',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Energy',
    sectorBenchmark: 'XLE',
    matchScore: 1.0,
  },
  {
    symbol: 'CVX',
    companyName: 'Chevron Corporation',
    exchange: 'NYSE',
    region: 'United States',
    assetType: 'Equity',
    currency: 'USD',
    sector: 'Energy',
    sectorBenchmark: 'XLE',
    matchScore: 1.0,
  },

  // Broad Market & Sector ETFs
  {
    symbol: 'SPY',
    companyName: 'SPDR S&P 500 ETF Trust',
    exchange: 'NYSE Arca',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Market Benchmark',
    sectorBenchmark: 'SPY',
    matchScore: 1.0,
  },
  {
    symbol: 'QQQ',
    companyName: 'Invesco QQQ Trust',
    exchange: 'NASDAQ',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Tech Benchmark',
    sectorBenchmark: 'QQQ',
    matchScore: 1.0,
  },
  {
    symbol: 'XLK',
    companyName: 'Technology Select Sector SPDR Fund',
    exchange: 'NYSE Arca',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Technology',
    sectorBenchmark: 'XLK',
    matchScore: 1.0,
  },
  {
    symbol: 'XLF',
    companyName: 'Financial Select Sector SPDR Fund',
    exchange: 'NYSE Arca',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Financials',
    sectorBenchmark: 'XLF',
    matchScore: 1.0,
  },
  {
    symbol: 'XLE',
    companyName: 'Energy Select Sector SPDR Fund',
    exchange: 'NYSE Arca',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Energy',
    sectorBenchmark: 'XLE',
    matchScore: 1.0,
  },
  {
    symbol: 'XLY',
    companyName: 'Consumer Discretionary Select Sector SPDR Fund',
    exchange: 'NYSE Arca',
    region: 'United States',
    assetType: 'ETF',
    currency: 'USD',
    sector: 'Consumer Discretionary',
    sectorBenchmark: 'XLY',
    matchScore: 1.0,
  },
];

/**
 * Searches the smart local catalog for matching instruments.
 * Prioritizes exact symbol matches, then symbol prefixes, then company name substrings.
 */
export function searchLocalCatalog(
  rawQuery: string,
  limit: number = 8
): InstrumentSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query || query.length < 2) return [];

  const exactSymbolMatches: InstrumentSearchResult[] = [];
  const prefixSymbolMatches: InstrumentSearchResult[] = [];
  const nameMatches: InstrumentSearchResult[] = [];

  for (const item of LOCAL_INSTRUMENT_CATALOG) {
    const sym = item.symbol.toLowerCase();
    const name = item.companyName.toLowerCase();

    if (sym === query) {
      exactSymbolMatches.push(item);
    } else if (sym.startsWith(query)) {
      prefixSymbolMatches.push(item);
    } else if (name.includes(query) || sym.includes(query)) {
      nameMatches.push(item);
    }
  }

  const combined = [...exactSymbolMatches, ...prefixSymbolMatches, ...nameMatches];
  // Deduplicate by symbol
  const seen = new Set<string>();
  const deduped: InstrumentSearchResult[] = [];
  for (const item of combined) {
    if (!seen.has(item.symbol)) {
      seen.add(item.symbol);
      deduped.push(item);
    }
    if (deduped.length >= limit) break;
  }

  return deduped;
}

/**
 * Helper to enrich a symbol with known sector and benchmark metadata if available.
 */
export function enrichKnownInstrumentMetadata(
  symbol: string,
  fallbackName?: string
): { sector?: string; sectorBenchmark?: string; companyName?: string } {
  const upper = symbol.toUpperCase();
  const found = LOCAL_INSTRUMENT_CATALOG.find((c) => c.symbol === upper);
  if (found) {
    return {
      sector: found.sector,
      sectorBenchmark: found.sectorBenchmark,
      companyName: found.companyName,
    };
  }
  return {
    companyName: fallbackName,
    sector: undefined,
    sectorBenchmark: 'SPY',
  };
}
