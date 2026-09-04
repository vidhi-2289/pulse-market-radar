/**
 * PULSE — Market Change Radar Domain Types
 * Single source-of-truth domain models
 */

export type FreshnessStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'CACHED_FALLBACK' | 'DEMO';

export type Severity = 'NOMINAL' | 'INFO' | 'ELEVATED' | 'CRITICAL';

export type DemoScenario =
  | 'QUIET'
  | 'STOCK_SPIKE'
  | 'SECTOR_RUN'
  | 'MARKET_CRASH'
  | 'STALE'
  | 'PROVIDER_FAILURE';

export interface MarketSnapshot {
  symbol: string;
  name: string;
  price: number;
  changePercent: number; // Raw change relative to previous day close
  volume?: number; // Cumulative day volume so far (optional if unsupplied by provider)
  avgDailyVolume?: number; // 20-day average daily volume (optional if unsupplied by provider)
  openPrice?: number; // Day opening price (optional if unsupplied by provider)
  highPrice?: number;
  lowPrice?: number;
  previousClose?: number;
  timestamp: string; // ISO 8601 string of the actual market trade/quote
  fetchedAt: string; // ISO 8601 string when Pulse received/ingested the data
  provider: string; // e.g. "DEMO", "CACHED_STORE", "TWELVE_DATA"
  freshness: FreshnessStatus;
  isSynthetic: boolean;
  quality?: 'HIGH' | 'DEGRADED' | 'FALLBACK';
  confidence?: number; // Optional quality confidence 0.0 to 1.0
}

export interface ProviderSnapshotsResult {
  snapshots: Record<string, MarketSnapshot>;
  freshness: FreshnessStatus;
  providerId: string;
  fetchedAt: string;
  notice?: string;
  sparklines?: Record<string, SparklinePoint[]>;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  sector: string;
  sectorEtf: string; // Benchmark ETF for sector, e.g. "XLK"
  displayOrder: number;
  exchange?: string;
}

export interface Checkpoint {
  id: string;
  timestamp: string; // ISO 8601 string
  label: string;
  snapshots: Record<string, MarketSnapshot>; // symbol -> snapshot at checkpoint
}

export type AnomalyReasonCode =
  | 'ALPHA_BREAKOUT'
  | 'VOLUME_SURGE'
  | 'GAP_UNFILLED'
  | 'SECTOR_DIVERGENCE'
  | 'VOLATILITY_EXPANSION'
  | 'BROAD_MARKET_BETA';

export interface AnomalyReason {
  code: AnomalyReasonCode;
  title: string;
  description: string;
  severity: Severity;
  contributionWeight: number; // Approximate score contribution
  metricValue: number;
  baselineValue: number;
}

export interface SparklinePoint {
  time: string;
  price: number;
}

export interface RadarItemResult {
  symbol: string;
  name: string;
  sector: string;
  sectorEtf: string;
  exchange?: string;
  currentPrice: number;
  checkpointPrice: number;
  priceChangePercent: number; // Return since checkpoint
  idiosyncraticChangePercent: number; // Decoupled from benchmark & sector
  benchmarkChangePercent: number; // Benchmark (SPY) return in interval
  sectorChangePercent: number; // Sector ETF return in interval
  volumeRatio: number; // Observed interval volume vs expected volume
  gapPercent: number; // Morning opening gap %
  gapHeld: boolean;
  rawScore: number; // Raw unbounded sum of signal contributions
  attentionScore: number; // Bounded 0 to 100
  severity: Severity;
  freshness: FreshnessStatus;
  reasons: AnomalyReason[];
  sparkline: SparklinePoint[];
}

export interface AttentionBudgetItem {
  symbol: string;
  name: string;
  severity: Severity;
  attentionScore: number;
  headlineReason: string;
  rank: number;
  priceChangePercent: number;
}

export interface AttentionBudget {
  totalMeaningfulCount: number;
  budgetCount: number; // 0 to 3
  items: AttentionBudgetItem[];
  isCalm: boolean;
  message: string; // e.g. "3 things worth your attention", "1 thing worth your attention", "Nothing needs your attention."
}

export interface RadarResponse {
  summary: {
    checkpointTimestamp: string;
    evaluatedAt: string;
    elapsedMinutes: number;
    totalAssetsTracked: number;
    anomaliesDetected: number; // Count of items with severity >= INFO (score >= 30)
    overallMarketStatus: 'NOMINAL' | 'ELEVATED' | 'HIGH_VOLATILITY';
    isCalmState: boolean; // True when 0 anomalies >= INFO
  };
  marketContext: {
    benchmarkSymbol: string;
    benchmarkChangePercent: number;
    dominantSectorMove?: {
      sector: string;
      sectorEtf: string;
      changePercent: number;
    };
  };
  freshness: {
    status: FreshnessStatus;
    lastFetchedAt: string;
    staleTickerCount: number;
    activeProvider: string;
    notice?: string;
  };
  items: RadarItemResult[]; // Sorted descending by attentionScore
  attentionBudget?: AttentionBudget;
}

export interface ScenarioDefinition {
  id: DemoScenario;
  name: string;
  tagline: string;
  description: string;
  freshness: FreshnessStatus;
  providerNotice?: string;
}

export interface UserSession {
  id: string;
  isGuest: boolean;
  createdAt: string;
}

export interface PersistedWatchlistItem {
  id: string;
  symbol: string;
  name: string | null;
  sector: string | null;
  sectorEtf: string | null;
  displayOrder: number;
  exchange?: string | null;
}

export interface PersistedWatchlist {
  id: string;
  name: string;
  isDefault: boolean;
  items: PersistedWatchlistItem[];
}

export interface PersistedCheckpoint {
  id: string;
  userId: string;
  watchlistId: string;
  checkpointTimestamp: string;
  label: string | null;
}

export interface AddWatchlistItemInput {
  symbol: string;
  name?: string;
  sector?: string;
  sectorEtf?: string;
  exchange?: string;
}

export interface InstrumentSearchResult {
  symbol: string;
  companyName: string;
  exchange?: string;
  region?: string;
  assetType?: string;
  currency?: string;
  matchScore?: number;
  sector?: string;
  sectorBenchmark?: string;
}
