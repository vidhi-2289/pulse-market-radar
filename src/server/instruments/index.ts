/**
 * PULSE — Instrument Discovery & Search Layer
 * Entry point exposing provider implementations and unified instrument search helper.
 */

import { InstrumentSearchResult } from '@/types';
import { IInstrumentSearchProvider } from './instrument-interface';
import { AlphaVantageSearchProvider } from './alphavantage-adapter';

export * from './instrument-interface';
export * from './local-catalog';
export * from './alphavantage-adapter';

export interface SearchInstrumentsResult {
  query: string;
  results: InstrumentSearchResult[];
  count: number;
  source: 'ALPHAVANTAGE' | 'LOCAL_CATALOG';
  notice?: string;
}

let defaultSearchProvider: IInstrumentSearchProvider | null = null;

export function getInstrumentSearchProvider(): IInstrumentSearchProvider {
  if (!defaultSearchProvider) {
    defaultSearchProvider = new AlphaVantageSearchProvider();
  }
  return defaultSearchProvider;
}

/**
 * High-level helper to search instruments across Alpha Vantage or the smart local catalog.
 */
export async function searchInstruments(
  query: string,
  limit: number = 8
): Promise<SearchInstrumentsResult> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return {
      query: cleanQuery,
      results: [],
      count: 0,
      source: 'LOCAL_CATALOG',
    };
  }

  const hasApiKey = Boolean(
    process.env.ALPHAVANTAGE_API_KEY && process.env.ALPHAVANTAGE_API_KEY.trim().length > 0
  );

  const provider = getInstrumentSearchProvider();
  const results = await provider.search(cleanQuery, { limit });

  return {
    query: cleanQuery,
    results,
    count: results.length,
    source: hasApiKey ? 'ALPHAVANTAGE' : 'LOCAL_CATALOG',
    notice: !hasApiKey
      ? 'Viewing instant local catalog. Configure ALPHAVANTAGE_API_KEY for global search.'
      : undefined,
  };
}
