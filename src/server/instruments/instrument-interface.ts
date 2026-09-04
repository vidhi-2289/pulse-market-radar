/**
 * PULSE — Instrument Search Provider Interface
 * Defines the vendor-neutral contract for company and ticker autocomplete.
 */

import { InstrumentSearchResult } from '@/types';

export interface SearchOptions {
  limit?: number;
}

export interface IInstrumentSearchProvider {
  readonly providerId: string;
  search(query: string, options?: SearchOptions): Promise<InstrumentSearchResult[]>;
}
