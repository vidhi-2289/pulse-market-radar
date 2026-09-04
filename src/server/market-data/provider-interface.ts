/**
 * PULSE — Market Data Provider Interface
 * Clean vendor-agnostic contract for market snapshot ingestion.
 */

import { MarketSnapshot, ProviderSnapshotsResult } from '@/types';

export type { ProviderSnapshotsResult };

export interface IMarketDataProvider {
  /**
   * Canonical identifier for the provider (e.g., 'DEMO', 'TWELVE_DATA', 'CACHED_STORE').
   */
  readonly providerId: string;

  /**
   * Whether this provider generates synthetic/simulated demo data.
   */
  readonly isDemo: boolean;

  /**
   * Asynchronously retrieves normalized market snapshots for the given symbols (or all tracked if omitted).
   */
  getSnapshots(symbols?: string[]): Promise<ProviderSnapshotsResult>;

  /**
   * Optional synchronous snapshot retrieval (for in-memory demo fixtures and SSR).
   */
  getSnapshotsSync?(symbols?: string[]): ProviderSnapshotsResult;

  /**
   * Asynchronously retrieves a single normalized snapshot for an asset.
   */
  getSnapshot(symbol: string): Promise<MarketSnapshot | null>;
}
