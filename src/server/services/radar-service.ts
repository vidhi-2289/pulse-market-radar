/**
 * PULSE — Radar Evaluation Service
 * Modular service coordinating market data providers, benchmarks, and the deterministic change engine.
 */

import {
  Checkpoint,
  DemoScenario,
  MarketSnapshot,
  RadarItemResult,
  RadarResponse,
  WatchlistItem,
} from '@/types';
import { evaluateRadarItem } from '../engine/change-engine';
import {
  IMarketDataProvider,
  getMarketDataProvider,
  ProviderMode,
  DEFAULT_WATCHLIST,
  INITIAL_CHECKPOINT,
  ProviderSnapshotsResult,
  isMarketDataProviderError,
} from '../market-data';

export interface EvaluateRadarOptions {
  scenario?: DemoScenario;
  mode?: ProviderMode;
  provider?: IMarketDataProvider;
  checkpoint?: Checkpoint;
  isAcknowledged?: boolean;
  elapsedMinutes?: number;
  watchlistItems?: WatchlistItem[];
  checkpointTimestamp?: string;
}

/**
 * Internal core logic evaluating radar items against normalized provider snapshots.
 */
function evaluateRadarInternal(
  options: EvaluateRadarOptions,
  provider: IMarketDataProvider,
  providerResult: ProviderSnapshotsResult
): RadarResponse {
  const {
    isAcknowledged = false,
    watchlistItems,
    checkpointTimestamp: customCheckpointTimestamp,
  } = options;

  const { snapshots, freshness, notice, sparklines = {}, fetchedAt } = providerResult;
  const evaluatedAt = new Date().toISOString();

  // Determine baseline checkpoint:
  // If acknowledged ("Mark as Seen"), baseline matches current scenario snapshots (zero delta)
  const checkpointSnapshots = isAcknowledged
    ? snapshots
    : options.checkpoint?.snapshots || INITIAL_CHECKPOINT.snapshots;

  const checkpointTimestamp = isAcknowledged
    ? evaluatedAt
    : customCheckpointTimestamp || options.checkpoint?.timestamp || INITIAL_CHECKPOINT.timestamp;

  // For deterministic demo scenarios evaluated against INITIAL_CHECKPOINT,
  // the fixture data represents a fixed 2-hour (120 minutes) market window.
  // An explicit options.elapsedMinutes overrides this if passed (e.g. in tests).
  // If custom snapshots are supplied with a custom checkpoint timestamp, elapsed is derived from that.
  const calculatedElapsed =
    options.checkpoint?.snapshots && customCheckpointTimestamp
      ? Math.max(1, Math.round((Date.now() - new Date(customCheckpointTimestamp).getTime()) / (60 * 1000)))
      : 120;

  const effectiveElapsedMinutes = isAcknowledged
    ? 0
    : options.elapsedMinutes ?? calculatedElapsed;

  const marketSnapshot = snapshots['SPY'];

  // 1. Compute broad benchmark return
  const benchmarkBasePrice = checkpointSnapshots['SPY']?.price || 554.0;
  const benchmarkCurrentPrice = marketSnapshot?.price || 554.0;
  const benchmarkReturn =
    benchmarkBasePrice > 0
      ? (benchmarkCurrentPrice - benchmarkBasePrice) / benchmarkBasePrice
      : 0;

  // 2. Evaluate each watchlist item through the deterministic engine
  const activeItems = watchlistItems && watchlistItems.length > 0 ? watchlistItems : DEFAULT_WATCHLIST;

  const evaluatedItems: RadarItemResult[] = activeItems.map((item) => {
    const currentSnap = snapshots[item.symbol] || {
      symbol: item.symbol,
      name: item.name,
      price: 100.0,
      changePercent: 0,
      volume: 1_000_000,
      avgDailyVolume: 5_000_000,
      openPrice: 100.0,
      highPrice: 100.5,
      lowPrice: 99.5,
      previousClose: 100.0,
      timestamp: evaluatedAt,
      fetchedAt,
      provider: provider.providerId,
      freshness,
      isSynthetic: provider.isDemo,
    };
    const checkpointSnap = checkpointSnapshots[item.symbol] || currentSnap;
    const sectorSnap = item.sectorEtf ? snapshots[item.sectorEtf] : undefined;
    const itemSparkline = sparklines[item.symbol] || [];

    return evaluateRadarItem({
      item,
      currentSnapshot: currentSnap,
      checkpointSnapshot: checkpointSnap,
      marketSnapshot,
      sectorSnapshot: sectorSnap,
      elapsedMinutes: effectiveElapsedMinutes,
      freshness,
      sparkline: itemSparkline,
      isAcknowledged,
    });
  });

  // 3. Rank items descending by attention score (highest priority first)
  evaluatedItems.sort((a, b) => b.attentionScore - a.attentionScore);

  // 4. Compute summary metrics
  const anomalies = evaluatedItems.filter((i) => i.severity !== 'NOMINAL');
  const anomaliesDetected = anomalies.length;
  const isCalmState = anomaliesDetected === 0;

  // 5. Check for dominant sector move (e.g., XLE in SECTOR_RUN)
  let dominantSectorMove: { sector: string; sectorEtf: string; changePercent: number } | undefined;
  const sectorEtfs = ['XLK', 'XLF', 'XLE', 'XLY'];
  for (const etf of sectorEtfs) {
    const snap = snapshots[etf];
    const baseSnap = checkpointSnapshots[etf];
    if (snap && baseSnap && baseSnap.price > 0) {
      const change = (snap.price - baseSnap.price) / baseSnap.price;
      if (Math.abs(change) >= 0.03) {
        dominantSectorMove = {
          sector: snap.name.replace(' Select Sector SPDR Fund', ''),
          sectorEtf: etf,
          changePercent: change,
        };
        break;
      }
    }
  }

  // 6. Overall market state classification
  const absBenchmark = Math.abs(benchmarkReturn);
  const overallMarketStatus: 'NOMINAL' | 'ELEVATED' | 'HIGH_VOLATILITY' =
    absBenchmark >= 0.025
      ? 'HIGH_VOLATILITY'
      : anomaliesDetected >= 3
      ? 'ELEVATED'
      : 'NOMINAL';

  const staleTickerCount = (Object.values(snapshots) as MarketSnapshot[]).filter((s) => s.freshness === 'STALE').length;

  return {
    summary: {
      checkpointTimestamp,
      evaluatedAt,
      elapsedMinutes: effectiveElapsedMinutes,
      totalAssetsTracked: activeItems.length,
      anomaliesDetected,
      overallMarketStatus,
      isCalmState,
    },
    marketContext: {
      benchmarkSymbol: 'SPY',
      benchmarkChangePercent: benchmarkReturn,
      dominantSectorMove,
    },
    freshness: {
      status: freshness,
      lastFetchedAt: fetchedAt,
      staleTickerCount: staleTickerCount > 0 ? staleTickerCount : (freshness === 'STALE' ? activeItems.length : 0),
      activeProvider: provider.providerId,
      notice,
    },
    items: evaluatedItems,
  };
}

/**
 * Synchronous service method to evaluate the full market radar (uses getSnapshotsSync).
 */
export function evaluateRadar(options: EvaluateRadarOptions = {}): RadarResponse {
  const { scenario = 'STOCK_SPIKE', mode = 'DEMO' } = options;
  const provider = options.provider ?? getMarketDataProvider({ mode, scenario });
  const providerResult = provider.getSnapshotsSync
    ? provider.getSnapshotsSync()
    : {
        snapshots: {},
        freshness: 'DEMO' as const,
        providerId: provider.providerId,
        fetchedAt: new Date().toISOString(),
      };

  return evaluateRadarInternal(options, provider, providerResult);
}

/**
 * Asynchronous service method to evaluate the full market radar (uses getSnapshots Promise contract).
 * Handles external provider outages gracefully by falling back to cached fallback data.
 */
export async function evaluateRadarAsync(options: EvaluateRadarOptions = {}): Promise<RadarResponse> {
  const { scenario = 'STOCK_SPIKE', mode = 'DEMO' } = options;
  const provider = options.provider ?? getMarketDataProvider({ mode, scenario });
  let providerResult: ProviderSnapshotsResult;

  try {
    providerResult = await provider.getSnapshots();
  } catch (err) {
    if (isMarketDataProviderError(err) || err instanceof Error) {
      console.warn(`[Pulse Radar Service] Provider ${provider.providerId} unavailable; falling back:`, err);
      const fallbackProvider = getMarketDataProvider({ scenario });
      const fallbackResult = fallbackProvider.getSnapshotsSync
        ? fallbackProvider.getSnapshotsSync()
        : await fallbackProvider.getSnapshots();

      providerResult = {
        ...fallbackResult,
        freshness: 'CACHED_FALLBACK',
        notice: `External provider unavailable (${err instanceof Error ? err.message : String(err)}). Serving cached fallback.`,
      };
    } else {
      throw err;
    }
  }

  return evaluateRadarInternal(options, provider, providerResult);
}
