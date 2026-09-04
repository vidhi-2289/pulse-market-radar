/**
 * PULSE — Demo Market Data Provider
 * Concrete implementation of IMarketDataProvider wrapping deterministic demo scenarios.
 *
 * Guarantees:
 * - 100% deterministic outputs
 * - No network calls
 * - No database mutations
 * - Normalized MarketSnapshot output contract
 */

import { DemoScenario, MarketSnapshot, ProviderSnapshotsResult } from '@/types';
import { IMarketDataProvider } from './provider-interface';
import { getScenarioSnapshots } from './mock-fixtures';

export class DemoMarketDataProvider implements IMarketDataProvider {
  public readonly providerId: string;
  public readonly isDemo = true;
  public readonly scenario: DemoScenario;

  constructor(scenario: DemoScenario = 'STOCK_SPIKE') {
    this.scenario = scenario;
    this.providerId = scenario === 'PROVIDER_FAILURE' ? 'CACHED_STORE' : 'DEMO';
  }

  /**
   * Synchronous snapshot retrieval (ideal for demo fixtures and SSR).
   */
  public getSnapshotsSync(symbols?: string[]): ProviderSnapshotsResult {
    const rawResult = getScenarioSnapshots(this.scenario);
    const fetchedAt = new Date().toISOString();

    let filteredSnapshots: Record<string, MarketSnapshot> = rawResult.snapshots;
    if (symbols && symbols.length > 0) {
      filteredSnapshots = {};
      symbols.forEach((sym) => {
        if (rawResult.snapshots[sym]) {
          filteredSnapshots[sym] = rawResult.snapshots[sym];
        }
      });
    }

    return {
      snapshots: filteredSnapshots,
      freshness: rawResult.freshness,
      providerId: this.providerId,
      fetchedAt,
      notice: rawResult.notice,
      sparklines: rawResult.sparklines,
    };
  }

  /**
   * Asynchronous snapshot retrieval conforming to IMarketDataProvider promise contract.
   */
  public async getSnapshots(symbols?: string[]): Promise<ProviderSnapshotsResult> {
    return Promise.resolve(this.getSnapshotsSync(symbols));
  }

  /**
   * Retrieves a single snapshot for a given symbol.
   */
  public async getSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    const result = this.getSnapshotsSync([symbol]);
    return result.snapshots[symbol] ?? null;
  }
}
