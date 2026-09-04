/**
 * PULSE — Deterministic Mock Fixtures & Scenarios
 * Provides deterministic baseline and scenario market snapshots for testing and demo evaluation.
 */

import {
  Checkpoint,
  DemoScenario,
  FreshnessStatus,
  MarketSnapshot,
  ScenarioDefinition,
  SparklinePoint,
  WatchlistItem,
} from '@/types';

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', sectorEtf: 'XLK', displayOrder: 1 },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', sectorEtf: 'XLK', displayOrder: 2 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', sectorEtf: 'XLK', displayOrder: 3 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', sectorEtf: 'XLY', displayOrder: 4 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', sectorEtf: 'XLF', displayOrder: 5 },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', sectorEtf: 'XLE', displayOrder: 6 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', sector: 'Market Benchmark', sectorEtf: 'SPY', displayOrder: 7 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', sector: 'Tech Benchmark', sectorEtf: 'QQQ', displayOrder: 8 },
];

export const DEMO_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'QUIET',
    name: 'Quiet Market (Nominal Drift)',
    tagline: 'Respecting your attention',
    description: 'All 8 assets move within normal bounds (+/- 0.3%) on average volume. Pulse triggers the serene "Nothing meaningful changed" calm state.',
    freshness: 'DEMO',
  },
  {
    id: 'STOCK_SPIKE',
    name: 'Single-Stock Spike (NVDA Breakout)',
    tagline: 'Company-specific catalyst',
    description: 'Broad market is flat, but NVDA jumps +6.8% with 3.4x volume and an unfilled morning gap, triggering a CRITICAL attention rating.',
    freshness: 'DEMO',
  },
  {
    id: 'SECTOR_RUN',
    name: 'Sector-Wide Run (Energy Surge)',
    tagline: 'Sector beta attribution',
    description: 'XOM jumps +4.5%, but XLE energy sector ETF is up +4.1%. Engine decouples sector tide from idiosyncratic company moves.',
    freshness: 'DEMO',
  },
  {
    id: 'MARKET_CRASH',
    name: 'Macro Selloff (Broad Market Drop)',
    tagline: 'Macro tide detection',
    description: 'SPY falls -3.2% on CPI data. Every tech stock drops in unison. Engine flags broad market tide rather than company failure.',
    freshness: 'DEMO',
  },
  {
    id: 'STALE',
    name: 'Stale / Delayed Data Feed',
    tagline: 'Data integrity transparency',
    description: 'Simulates a 48-minute delayed market stream. UI displays visible orange STALE badges and confidence intervals.',
    freshness: 'STALE',
    providerNotice: 'Market data feed delayed 48m. Scores computed against last verified prints.',
  },
  {
    id: 'PROVIDER_FAILURE',
    name: 'Upstream Provider Outage',
    tagline: 'Zero-excuses fallback resilience',
    description: 'External API returns 500 Internal Error. System gracefully engages circuit-breaker, serving cached snapshots with zero crash.',
    freshness: 'CACHED_FALLBACK',
    providerNotice: 'Upstream provider connection offline (Simulated HTTP 500). Operating in resilient cached fallback mode.',
  },
];

// Helper to generate realistic sparkline points
function generateSparkline(
  startPrice: number,
  endPrice: number,
  points: number = 8,
  noiseFactor: number = 0.002
): SparklinePoint[] {
  const result: SparklinePoint[] = [];
  const delta = (endPrice - startPrice) / (points - 1);
  const now = Date.now();
  const stepMs = (2 * 60 * 60 * 1000) / points; // 2 hours window

  for (let i = 0; i < points; i++) {
    const progressPrice = startPrice + delta * i;
    // Add deterministic micro variance
    const variance = (Math.sin(i * 1.5) * noiseFactor + (i % 2 === 0 ? 0.001 : -0.001)) * startPrice;
    const price = i === points - 1 ? endPrice : i === 0 ? startPrice : Math.round((progressPrice + variance) * 100) / 100;
    const time = new Date(now - (points - 1 - i) * stepMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    result.push({ time, price });
  }
  return result;
}

// Canonical $T_0$ Checkpoint (Baseline captured 2h ago)
const initialCheckpointTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const RAW_BASE_SNAPSHOTS: Record<string, Omit<MarketSnapshot, 'fetchedAt' | 'freshness'>> = {
    NVDA: {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 122.0,
      changePercent: 0.005,
      volume: 18_000_000,
      avgDailyVolume: 52_000_000,
      openPrice: 121.5,
      highPrice: 122.8,
      lowPrice: 121.0,
      previousClose: 121.4,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    AAPL: {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 224.5,
      changePercent: 0.002,
      volume: 14_000_000,
      avgDailyVolume: 48_000_000,
      openPrice: 224.0,
      highPrice: 225.2,
      lowPrice: 223.8,
      previousClose: 224.05,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    MSFT: {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      price: 448.0,
      changePercent: -0.001,
      volume: 8_000_000,
      avgDailyVolume: 22_000_000,
      openPrice: 448.5,
      highPrice: 449.2,
      lowPrice: 447.1,
      previousClose: 448.45,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    TSLA: {
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      price: 218.0,
      changePercent: 0.003,
      volume: 24_000_000,
      avgDailyVolume: 68_000_000,
      openPrice: 217.5,
      highPrice: 219.0,
      lowPrice: 216.8,
      previousClose: 217.35,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    JPM: {
      symbol: 'JPM',
      name: 'JPMorgan Chase & Co.',
      price: 212.0,
      changePercent: 0.001,
      volume: 4_500_000,
      avgDailyVolume: 12_000_000,
      openPrice: 211.8,
      highPrice: 212.5,
      lowPrice: 211.4,
      previousClose: 211.79,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    XOM: {
      symbol: 'XOM',
      name: 'Exxon Mobil Corporation',
      price: 116.0,
      changePercent: 0.002,
      volume: 6_000_000,
      avgDailyVolume: 16_000_000,
      openPrice: 115.8,
      highPrice: 116.4,
      lowPrice: 115.5,
      previousClose: 115.77,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    SPY: {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      price: 554.0,
      changePercent: 0.001,
      volume: 22_000_000,
      avgDailyVolume: 65_000_000,
      openPrice: 553.5,
      highPrice: 554.6,
      lowPrice: 553.0,
      previousClose: 553.45,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    QQQ: {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      price: 478.0,
      changePercent: 0.002,
      volume: 18_000_000,
      avgDailyVolume: 45_000_000,
      openPrice: 477.5,
      highPrice: 478.8,
      lowPrice: 477.0,
      previousClose: 477.04,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    XLK: {
      symbol: 'XLK',
      name: 'Technology Select Sector SPDR Fund',
      price: 222.0,
      changePercent: 0.002,
      volume: 5_000_000,
      avgDailyVolume: 14_000_000,
      openPrice: 221.8,
      highPrice: 222.5,
      lowPrice: 221.4,
      previousClose: 221.56,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    XLF: {
      symbol: 'XLF',
      name: 'Financial Select Sector SPDR Fund',
      price: 44.5,
      changePercent: 0.001,
      volume: 12_000_000,
      avgDailyVolume: 35_000_000,
      openPrice: 44.4,
      highPrice: 44.6,
      lowPrice: 44.3,
      previousClose: 44.46,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    XLE: {
      symbol: 'XLE',
      name: 'Energy Select Sector SPDR Fund',
      price: 88.0,
      changePercent: 0.002,
      volume: 7_000_000,
      avgDailyVolume: 18_000_000,
      openPrice: 87.8,
      highPrice: 88.3,
      lowPrice: 87.6,
      previousClose: 87.82,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'MOCK_ENGINE',
      isSynthetic: true,
    },
    XLY: {
      symbol: 'XLY',
      name: 'Consumer Discretionary Select Sector SPDR Fund',
      price: 188.0,
      changePercent: 0.002,
      volume: 3_000_000,
      avgDailyVolume: 8_000_000,
      openPrice: 187.6,
      highPrice: 188.4,
      lowPrice: 187.2,
      previousClose: 187.62,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'DEMO',
      isSynthetic: true,
    },
};

export const INITIAL_CHECKPOINT: Checkpoint = {
  id: 'chk_default_initial',
  timestamp: initialCheckpointTime,
  label: 'Session Baseline (2h ago)',
  snapshots: Object.fromEntries(
    Object.entries(RAW_BASE_SNAPSHOTS).map(([sym, snap]) => [
      sym,
      {
        ...snap,
        fetchedAt: initialCheckpointTime,
        freshness: 'DEMO' as FreshnessStatus,
        quality: 'HIGH' as const,
      },
    ])
  ),
};

// 2-hour nominal cumulative volume baseline (corresponds to expected 1.0x volume ratio over 120 minutes)
// Derived from: baselineVolume + Math.round(avgDailyVolume * (120 / 390))
const NOMINAL_2H_VOLUMES: Record<string, number> = {
  NVDA: 34_000_000,
  AAPL: 28_770_000,
  MSFT: 14_770_000,
  TSLA: 44_920_000,
  JPM: 8_190_000,
  XOM: 10_920_000,
  SPY: 42_000_000,
  QQQ: 31_850_000,
  XLK: 9_310_000,
  XLF: 22_770_000,
  XLE: 12_540_000,
  XLY: 5_460_000,
};

/**
 * Generates deterministic current snapshots for the requested scenario.
 * Always builds against immutable INITIAL_CHECKPOINT to prevent state contamination.
 */
export function getScenarioSnapshots(
  scenario: DemoScenario = 'STOCK_SPIKE'
): {
  snapshots: Record<string, MarketSnapshot>;
  freshness: FreshnessStatus;
  notice?: string;
  sparklines: Record<string, SparklinePoint[]>;
} {
  const base = INITIAL_CHECKPOINT.snapshots;
  const now = new Date().toISOString();
  const result: Record<string, MarketSnapshot> = {};
  const sparklines: Record<string, SparklinePoint[]> = {};

  // Clone canonical base as initial baseline, initializing volume to nominal 2-hour pace (1.0x expected ratio)
  Object.keys(base).forEach((sym) => {
    result[sym] = {
      ...base[sym],
      timestamp: now,
      fetchedAt: now,
      freshness: 'DEMO',
      quality: 'HIGH',
      provider: 'DEMO',
      volume: NOMINAL_2H_VOLUMES[sym] ?? base[sym].volume,
    };
  });

  let freshness: FreshnessStatus = 'DEMO';
  let notice: string | undefined;

  switch (scenario) {
    case 'QUIET': {
      // Nominal drift: +/- 0.1% to 0.3%, normal ~1.0x volume, no gaps
      freshness = 'DEMO';
      result.NVDA.price = 122.25; // +0.20%
      result.AAPL.price = 224.2;  // -0.13%
      result.MSFT.price = 448.6;  // +0.13%
      result.TSLA.price = 217.6;  // -0.18%
      result.JPM.price = 212.35;  // +0.17%
      result.XOM.price = 116.2;   // +0.17%

      result.SPY.price = 554.4;   // +0.07%
      result.QQQ.price = 478.6;   // +0.13%
      result.XLK.price = 222.3;   // +0.14%
      result.XLF.price = 44.55;   // +0.11%
      result.XLE.price = 88.15;   // +0.17%
      result.XLY.price = 188.2;   // +0.11%
      break;
    }

    case 'STOCK_SPIKE': {
      // NVDA idiosyncratic anomaly: +6.8% with 3.4x volume and sustained opening gap
      freshness = 'DEMO';
      result.NVDA.price = 130.3; // +6.80% jump
      // 18M baseline + 3.4 * (52M * 120/390 = 16M) = 72.4M (3.40x volume ratio)
      result.NVDA.volume = 72_400_000;
      result.NVDA.openPrice = 124.5; // Gap up +2.55% from prevClose 121.4
      result.NVDA.highPrice = 130.8;
      result.NVDA.lowPrice = 124.2;

      // Broad market and sectors are quiet
      result.SPY.price = 554.8;  // +0.14%
      result.QQQ.price = 479.2;  // +0.25%
      result.XLK.price = 222.6;  // +0.27%
      result.XLF.price = 44.52;  // +0.04%
      result.XLE.price = 88.05;  // +0.06%
      result.XLY.price = 188.1;  // +0.05%

      // Unrelated equities remain flat/quiet with normal ~1.0x volume and no gaps
      result.AAPL.price = 224.6; // +0.04%
      result.AAPL.openPrice = 224.2;
      result.AAPL.highPrice = 224.9;
      result.AAPL.lowPrice = 223.9;

      result.MSFT.price = 447.8; // -0.04%
      result.MSFT.openPrice = 448.2;
      result.MSFT.highPrice = 448.8;
      result.MSFT.lowPrice = 447.5;

      result.TSLA.price = 218.4; // +0.18%
      result.TSLA.openPrice = 217.8;
      result.TSLA.highPrice = 218.9;
      result.TSLA.lowPrice = 217.4;

      result.JPM.price = 212.1;  // +0.05%
      result.JPM.openPrice = 211.9;
      result.JPM.highPrice = 212.4;
      result.JPM.lowPrice = 211.7;

      result.XOM.price = 116.1;  // +0.09%
      result.XOM.openPrice = 115.9;
      result.XOM.highPrice = 116.3;
      result.XOM.lowPrice = 115.7;
      break;
    }

    case 'SECTOR_RUN': {
      // Energy sector rally: XLE ETF +4.09%, XOM +4.50%
      freshness = 'DEMO';
      // Sector ETF surges +4.09% on 2.0x volume
      result.XLE.price = 91.6;
      // 7M baseline + 2.0 * 5.54M = 18.08M
      result.XLE.volume = 18_080_000;

      // XOM moves with its sector: +4.50% on 2.0x volume
      result.XOM.price = 121.22;
      // 6M baseline + 2.0 * 4.92M = 15.85M
      result.XOM.volume = 15_850_000;
      result.XOM.openPrice = 116.3;
      result.XOM.highPrice = 121.5;
      result.XOM.lowPrice = 115.9;

      result.SPY.price = 555.2; // +0.22%
      result.QQQ.price = 478.5; // +0.10%
      result.XLK.price = 222.2; // +0.09%
      result.XLF.price = 44.52; // +0.04%
      result.XLY.price = 188.1; // +0.05%

      // Non-energy equities remain nominal at 1.0x volume
      result.NVDA.price = 122.2; // +0.16%
      result.AAPL.price = 224.6; // +0.04%
      result.MSFT.price = 448.2; // +0.04%
      result.TSLA.price = 218.2; // +0.09%
      result.JPM.price = 212.3;  // +0.14%
      break;
    }

    case 'MARKET_CRASH': {
      // Macro selloff: SPY -3.2%, QQQ -4.1%, tech sinks together
      freshness = 'DEMO';
      result.SPY.price = 536.27; // -3.20%
      result.SPY.volume = 58_000_000; // 1.8x volume

      result.QQQ.price = 458.4;  // -4.10%
      result.QQQ.volume = 42_930_000; // 1.8x volume

      result.XLK.price = 212.45; // -4.30%
      result.XLK.volume = 12_760_000;

      result.XLF.price = 43.4;   // -2.47%
      result.XLF.volume = 29_230_000;

      result.XLE.price = 86.8;   // -1.36%
      result.XLE.volume = 15_310_000;

      result.XLY.price = 180.8;  // -3.83%
      result.XLY.volume = 7_430_000;

      // Equities decline with the tide; volumes elevated at realistic 1.4x-1.5x
      result.NVDA.price = 116.14; // -4.80%
      result.NVDA.volume = 42_000_000; // 1.5x volume

      result.AAPL.price = 216.64; // -3.50%
      result.AAPL.volume = 36_150_000; // 1.5x volume

      result.MSFT.price = 432.77; // -3.40%
      result.MSFT.volume = 18_150_000; // 1.5x volume

      result.TSLA.price = 206.66; // -5.20%
      result.TSLA.volume = 55_380_000; // 1.5x volume

      result.JPM.price = 207.34;  // -2.20%
      result.JPM.volume = 10_040_000; // 1.5x volume

      result.XOM.price = 114.72;  // -1.10%
      result.XOM.volume = 12_890_000; // 1.4x volume
      break;
    }

    case 'STALE': {
      // Same nominal prices & volumes as QUIET, but market print timestamp is delayed 48 minutes
      freshness = 'STALE';
      notice = 'Data stream delayed 48m. Scores computed against last verified exchange prints.';
      const staleTimestamp = new Date(Date.now() - 48 * 60 * 1000).toISOString();

      Object.keys(result).forEach((sym) => {
        result[sym].timestamp = staleTimestamp;
        result[sym].fetchedAt = now; // Pulse fetched it now, but trade print is 48m old
        result[sym].freshness = 'STALE';
        result[sym].quality = 'DEGRADED';
      });

      result.NVDA.price = 122.25; // Nominal price (no artificial shock)
      break;
    }

    case 'PROVIDER_FAILURE': {
      // Circuit breaker fallback to cached snapshots with baseline values
      freshness = 'CACHED_FALLBACK';
      notice = 'Primary data feed unavailable (HTTP 500). Running in resilient offline mode using cached snapshots.';

      Object.keys(base).forEach((sym) => {
        result[sym] = {
          ...base[sym],
          fetchedAt: now,
          freshness: 'CACHED_FALLBACK',
          quality: 'FALLBACK',
          volume: NOMINAL_2H_VOLUMES[sym] ?? base[sym].volume,
          provider: 'CACHED_STORE',
        };
      });
      break;
    }
  }

  // Ensure freshness is consistently stamped on all output snapshots
  Object.keys(result).forEach((sym) => {
    result[sym].freshness = freshness;
  });

  // Generate sparklines matching the start and end price
  Object.keys(result).forEach((sym) => {
    const pStart = base[sym]?.price || result[sym].price;
    const pEnd = result[sym].price;
    sparklines[sym] = generateSparkline(pStart, pEnd, 8);
  });

  return { snapshots: result, freshness, notice, sparklines };
}
